import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { EventBusService, EventRoutingKey, ItemSoldEvent, ItemSoldLine } from "@mms/shared";
import { computeLinePrice } from "../products/pricing";
import { ProductsService } from "../products/products.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryGrpcClientService } from "../inventory-grpc-client/inventory-grpc-client.service";
import { CheckoutDto } from "./dto/checkout.dto";

interface ReservedLine {
  sku: string;
  productId: string;
  productName: string;
  quantitySold: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  reservationId: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly inventory: InventoryGrpcClientService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * FR-6.2/6.3/6.5/6.6 — checks and reserves stock for every line over gRPC
   * before writing anything. If any line is unavailable, every reservation
   * already taken earlier in this same checkout is released (compensating
   * loop) so a partial cart never holds stock hostage.
   */
  async checkout(dto: CheckoutDto): Promise<unknown> {
    const transactionId = randomUUID();
    const now = new Date();
    const reserved: ReservedLine[] = [];

    try {
      for (const line of dto.lines) {
        const product = await this.products.getActivePriceAndPromotion(line.sku, now);
        const reservation = await this.inventory.checkAndReserveStock({
          sku: line.sku,
          locationCode: dto.locationCode,
          quantityRequested: line.quantity,
          transactionReference: transactionId,
        });
        if (!reservation.available) {
          throw new BadRequestException(
            `SKU ${line.sku} does not have ${line.quantity} units available at ${dto.locationCode}`,
          );
        }

        const pricing = computeLinePrice(
          product.unitPrice,
          line.quantity,
          product.activePromotion,
          product.taxRatePct,
        );
        reserved.push({
          sku: line.sku,
          productId: product.id,
          productName: product.name,
          quantitySold: line.quantity,
          unitPrice: product.unitPrice,
          discountAmount: pricing.discountAmount,
          taxAmount: pricing.taxAmount,
          lineTotal: pricing.lineTotal,
          reservationId: reservation.reservationId,
        });
      }
    } catch (error) {
      await Promise.allSettled(
        reserved.map((line) => this.inventory.releaseReservation(line.reservationId)),
      );
      throw error;
    }

    const subtotalAmount = round2(reserved.reduce((sum, l) => sum + l.unitPrice * l.quantitySold, 0));
    const discountAmount = round2(reserved.reduce((sum, l) => sum + l.discountAmount, 0));
    const taxAmount = round2(reserved.reduce((sum, l) => sum + l.taxAmount, 0));
    const totalAmount = round2(reserved.reduce((sum, l) => sum + l.lineTotal, 0));

    const paymentsTotal = round2(dto.payments.reduce((sum, p) => sum + p.amount, 0));
    if (paymentsTotal !== totalAmount) {
      await Promise.allSettled(
        reserved.map((line) => this.inventory.releaseReservation(line.reservationId)),
      );
      throw new BadRequestException(
        `Payments total ${paymentsTotal} does not match the sale total ${totalAmount}`,
      );
    }

    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('"Transaction"', 'sequence')) AS nextval
    `;
    const sequence = Number(nextval);

    const transaction = await this.prisma.transaction.create({
      data: {
        id: transactionId,
        sequence,
        transactionNumber: `TXN-${1000 + sequence}`,
        storeId: dto.storeId,
        registerId: dto.registerId,
        cashierId: dto.cashierId,
        subtotalAmount,
        discountAmount,
        taxAmount,
        totalAmount,
        lines: {
          create: reserved.map((line) => ({
            productId: line.productId,
            sku: line.sku,
            productName: line.productName,
            quantitySold: line.quantitySold,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
            reservationId: line.reservationId,
            locationCode: dto.locationCode,
          })),
        },
        payments: {
          create: dto.payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
          })),
        },
      },
      include: { lines: true, payments: true },
    });

    const eventLines: ItemSoldLine[] = reserved.map((line) => ({
      sku: line.sku,
      productName: line.productName,
      quantitySold: line.quantitySold,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      reservationId: line.reservationId,
    }));
    const event: ItemSoldEvent = {
      eventId: randomUUID(),
      occurredAt: now.toISOString(),
      transactionId: transaction.id,
      storeId: dto.storeId,
      registerId: dto.registerId,
      cashierId: dto.cashierId,
      lines: eventLines,
      paymentMethods: dto.payments.map((p) => ({ method: p.method, amount: p.amount })),
      totalAmount,
    };
    await this.eventBus.publish(EventRoutingKey.ITEM_SOLD, event);

    return transaction;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
