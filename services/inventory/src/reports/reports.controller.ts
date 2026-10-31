import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Exportable, Role, Roles } from "@mms/shared";
import { InventoryTransactionType } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { classifyMovement, MovementRow } from "./stock-movement";
import { StockMovementQuery } from "./stock-movement.query";

const DAY_MS = 86_400_000;

@ApiTags("reports")
@Roles(Role.OWNER, Role.MANAGER, Role.BUYER, Role.ACCOUNTANT)
@Controller("reports")
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  /** D-20 — slow movers and dead stock: every product held, with its sales over the window. */
  @Get("stock-movement")
  @Exportable<MovementRow>("stock-movement", [
    { header: "Status", value: (r) => r.status },
    { header: "SKU", value: (r) => r.sku },
    { header: "Product", value: (r) => r.productName },
    { header: "Category", value: (r) => r.category },
    { header: "Location", value: (r) => r.locationCode },
    { header: "On hand", value: (r) => r.onHand },
    { header: "Stock value (KES)", value: (r) => r.stockValue },
    { header: "Units sold in window", value: (r) => r.unitsSold },
    { header: "Days of cover", value: (r) => r.daysOfCover },
    { header: "Last sale", value: (r) => r.lastSaleAt },
  ])
  async stockMovement(@Query() query: StockMovementQuery): Promise<MovementRow[]> {
    const days = query.days ?? 90;
    const since = new Date(Date.now() - days * DAY_MS);
    const sale = { type: InventoryTransactionType.SALE, locationCode: query.locationCode };

    const [levels, inWindow, lastSales] = await Promise.all([
      this.prisma.stockLevel.findMany({
        where: {
          locationCode: query.locationCode,
          onHand: { gt: 0 },
          product: query.category ? { category: { equals: query.category, mode: "insensitive" } } : undefined,
        },
        include: { product: true },
      }),
      this.prisma.inventoryTransaction.groupBy({
        by: ["productId", "locationCode"],
        where: { ...sale, createdAt: { gte: since } },
        _sum: { quantityDelta: true },
      }),
      this.prisma.inventoryTransaction.groupBy({
        by: ["productId", "locationCode"],
        where: sale,
        _max: { createdAt: true },
      }),
    ]);

    const key = (productId: string, locationCode: string) => `${productId}|${locationCode}`;
    // Sales are recorded as negative deltas.
    const sold = new Map(inWindow.map((r) => [key(r.productId, r.locationCode), Math.abs(r._sum.quantityDelta ?? 0)]));
    const last = new Map(lastSales.map((r) => [key(r.productId, r.locationCode), r._max.createdAt]));

    const rows = classifyMovement(
      levels.map((level) => ({
        sku: level.product.sku,
        productName: level.product.name,
        category: level.product.category,
        locationCode: level.locationCode,
        onHand: level.onHand,
        unitCost: Number(level.product.unitCost),
        unitsSold: sold.get(key(level.productId, level.locationCode)) ?? 0,
        lastSaleAt: last.get(key(level.productId, level.locationCode)) ?? null,
      })),
      days,
      query.slowAfterDays ?? 90,
    );
    return query.status ? rows.filter((r) => r.status === query.status) : rows;
  }
}
