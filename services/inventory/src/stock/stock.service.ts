import { randomUUID } from "crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventBusService, EventRoutingKey, GoodsReceivedEvent, StockLowEvent } from "@mms/shared";
import {
  InventoryTransactionType,
  Product,
  ReservationStatus,
  StockLevel,
} from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

const VELOCITY_WINDOW_DAYS = 14;

export interface StockCheckOutcome {
  available: boolean;
  quantityReserved: number;
  availableQuantityAfterReservation: number;
  reservationId: string;
}

/**
 * Owns every mutation to StockLevel/InventoryTransaction/Reservation.
 * Shared by the REST product-adjustment endpoint, the gRPC checkout path
 * (FR-4.5/NFR-5), and the GoodsReceived/ItemSold event consumers — so
 * "increase on receipt, decrease on sale" (FR-4.2) has exactly one
 * implementation.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);
  private readonly reorderLeadTimeDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
  ) {
    this.reorderLeadTimeDays = Number(
      this.config.get<string>("REORDER_LEAD_TIME_DAYS") ?? 7,
    );
  }

  async getStockLevelsForSku(sku: string) {
    const product = await this.getProductOrThrow(sku);
    const levels = await this.prisma.stockLevel.findMany({
      where: { productId: product.id },
    });
    return levels.map((level) => this.withAvailable(level));
  }

  async listStockLevels(locationCode?: string) {
    const levels = await this.prisma.stockLevel.findMany({
      where: locationCode ? { locationCode } : undefined,
      include: { product: true },
    });
    return levels.map((level) => ({
      ...this.withAvailable(level),
      sku: level.product.sku,
    }));
  }

  /** FR-4.8 — manual stock adjustment (e.g. after a physical count). */
  async adjust(
    sku: string,
    locationCode: string,
    quantityDelta: number,
    reason: string,
  ) {
    const product = await this.getProductOrThrow(sku);
    await this.upsertLevel(product.id, locationCode, product.unitCost);
    const level = await this.prisma.stockLevel.update({
      where: { productId_locationCode: { productId: product.id, locationCode } },
      data: { onHand: { increment: quantityDelta } },
    });
    await this.recordTransaction(
      product.id,
      locationCode,
      InventoryTransactionType.ADJUSTMENT,
      quantityDelta,
      "ADJUSTMENT",
      reason,
    );
    return this.withAvailable(level);
  }

  /**
   * FR-4.2 — increase stock on GoodsReceived. Damaged lines are quarantined
   * upstream (FR-3.4) and are never added to sellable On Hand here.
   */
  async applyGoodsReceived(event: GoodsReceivedEvent): Promise<void> {
    for (const line of event.lines) {
      if (line.condition !== "GOOD" || line.quantityReceived <= 0) continue;

      const product = await this.prisma.product.findUnique({
        where: { sku: line.sku },
      });
      if (!product) {
        this.logger.warn(
          `GoodsReceived for unknown SKU ${line.sku} (GRN ${event.grnNumber}) — no product master record yet, skipping`,
        );
        continue;
      }

      await this.upsertLevel(product.id, event.receivedAtLocation, product.unitCost);
      await this.prisma.stockLevel.update({
        where: {
          productId_locationCode: {
            productId: product.id,
            locationCode: event.receivedAtLocation,
          },
        },
        data: { onHand: { increment: line.quantityReceived } },
      });
      await this.recordTransaction(
        product.id,
        event.receivedAtLocation,
        InventoryTransactionType.RECEIPT,
        line.quantityReceived,
        "GRN",
        event.grnNumber,
      );
    }
  }

  /** FR-4.5 / FR-6.2 / NFR-5 — the gRPC checkout stock check + reservation. */
  async reserve(
    sku: string,
    locationCode: string,
    quantityRequested: number,
    transactionReference: string,
  ): Promise<StockCheckOutcome> {
    const product = await this.getProductOrThrow(sku);
    await this.upsertLevel(product.id, locationCode, product.unitCost);
    const level = await this.prisma.stockLevel.findUniqueOrThrow({
      where: { productId_locationCode: { productId: product.id, locationCode } },
    });

    const available = level.onHand - level.allocated;
    if (available < quantityRequested) {
      return {
        available: false,
        quantityReserved: 0,
        availableQuantityAfterReservation: available,
        reservationId: "",
      };
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        productId: product.id,
        locationCode,
        quantity: quantityRequested,
        transactionReference,
      },
    });
    await this.prisma.stockLevel.update({
      where: { id: level.id },
      data: { allocated: { increment: quantityRequested } },
    });
    await this.recordTransaction(
      product.id,
      locationCode,
      InventoryTransactionType.RESERVATION,
      quantityRequested,
      "POS_TXN",
      transactionReference,
    );

    return {
      available: true,
      quantityReserved: quantityRequested,
      availableQuantityAfterReservation: available - quantityRequested,
      reservationId: reservation.id,
    };
  }

  /** Abandons a reservation without a sale (payment failed, line voided). */
  async releaseReservation(reservationId: string): Promise<boolean> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
      return false;
    }

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.RELEASED },
    });
    await this.prisma.stockLevel.updateMany({
      where: {
        productId: reservation.productId,
        locationCode: reservation.locationCode,
      },
      data: { allocated: { decrement: reservation.quantity } },
    });
    await this.recordTransaction(
      reservation.productId,
      reservation.locationCode,
      InventoryTransactionType.RELEASE,
      -reservation.quantity,
      "RESERVATION",
      reservationId,
    );
    return true;
  }

  /** FR-4.2 — decrease stock on ItemSold, finalizing the checkout reservation. */
  async consumeReservationForSale(
    reservationId: string,
    quantitySold: number,
    transactionReference: string,
  ): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
      this.logger.warn(
        `ItemSold referenced reservation ${reservationId}, which is not active — skipping stock decrement`,
      );
      return;
    }

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONSUMED },
    });
    await this.prisma.stockLevel.updateMany({
      where: {
        productId: reservation.productId,
        locationCode: reservation.locationCode,
      },
      data: {
        onHand: { decrement: quantitySold },
        allocated: { decrement: reservation.quantity },
      },
    });
    await this.recordTransaction(
      reservation.productId,
      reservation.locationCode,
      InventoryTransactionType.SALE,
      -quantitySold,
      "POS_TXN",
      transactionReference,
    );

    await this.recomputeVelocityAndMaybePublishStockLow(
      reservation.productId,
      reservation.locationCode,
    );
  }

  /** FR-4.6 / D-3 — dynamic, velocity-derived reorder threshold, not a static number. */
  private async recomputeVelocityAndMaybePublishStockLow(
    productId: string,
    locationCode: string,
  ): Promise<void> {
    const since = new Date(Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const sales = await this.prisma.inventoryTransaction.aggregate({
      where: {
        productId,
        type: InventoryTransactionType.SALE,
        createdAt: { gte: since },
      },
      _sum: { quantityDelta: true },
    });
    const unitsSold = Math.abs(sales._sum.quantityDelta ?? 0);
    const unitsPerDay = unitsSold / VELOCITY_WINDOW_DAYS;

    await this.prisma.salesVelocity.create({
      data: { productId, unitsPerDay, windowDays: VELOCITY_WINDOW_DAYS },
    });

    const dynamicReorderThreshold = Math.ceil(unitsPerDay * this.reorderLeadTimeDays);
    const level = await this.prisma.stockLevel.findUnique({
      where: { productId_locationCode: { productId, locationCode } },
    });
    if (!level) return;

    const available = level.onHand - level.allocated;
    if (available > dynamicReorderThreshold) return;

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const event: StockLowEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      sku: product.sku,
      productName: product.name,
      locationCode,
      availableQuantity: available,
      dynamicReorderThreshold,
      salesVelocityUnitsPerDay: unitsPerDay,
    };
    await this.eventBus.publish(EventRoutingKey.STOCK_LOW, event);
  }

  async valuationReport() {
    const levels = await this.prisma.stockLevel.findMany({
      include: { product: true },
    });

    const byProduct = new Map<
      string,
      { sku: string; productName: string; onHand: number; unitCost: number }
    >();
    for (const level of levels) {
      const entry = byProduct.get(level.productId) ?? {
        sku: level.product.sku,
        productName: level.product.name,
        onHand: 0,
        unitCost: Number(level.product.unitCost),
      };
      entry.onHand += level.onHand;
      byProduct.set(level.productId, entry);
    }

    const rows = [...byProduct.values()].map((row) => ({
      ...row,
      totalValue: row.onHand * row.unitCost,
    }));

    return {
      asOf: new Date().toISOString(),
      totalValue: rows.reduce((sum, row) => sum + row.totalValue, 0),
      byProduct: rows,
    };
  }

  private async upsertLevel(
    productId: string,
    locationCode: string,
    unitValue: Product["unitCost"],
  ): Promise<void> {
    await this.prisma.stockLevel.upsert({
      where: { productId_locationCode: { productId, locationCode } },
      create: { productId, locationCode, onHand: 0, allocated: 0, unitValue },
      update: {},
    });
  }

  private async recordTransaction(
    productId: string,
    locationCode: string,
    type: InventoryTransactionType,
    quantityDelta: number,
    referenceType: string,
    referenceId: string,
  ): Promise<void> {
    await this.prisma.inventoryTransaction.create({
      data: { productId, locationCode, type, quantityDelta, referenceType, referenceId },
    });
  }

  private async getProductOrThrow(sku: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { sku } });
    if (!product) {
      throw new NotFoundException(`Product ${sku} not found`);
    }
    return product;
  }

  private withAvailable(level: StockLevel) {
    return { ...level, available: level.onHand - level.allocated };
  }
}
