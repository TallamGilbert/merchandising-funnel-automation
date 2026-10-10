import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DateRangeQueryDto, dateRange, Exportable, Role, Roles } from "@mms/shared";
import { PurchaseOrderStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { supplierPerformance, SupplierPerformanceRow } from "./supplier-performance";

const COMMITTED: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.APPROVED,
  PurchaseOrderStatus.SENT,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
  PurchaseOrderStatus.CLOSED,
];

@ApiTags("reports")
@Roles(Role.OWNER, Role.MANAGER, Role.BUYER, Role.ACCOUNTANT)
@Controller("reports")
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * D-20 — per supplier, for POs approved between from and to: orders,
   * KES spend, units ordered vs received, and fill rate on closed POs.
   * On-time delivery comes from Vendor Management's /suppliers/performance.
   */
  @Get("supplier-performance")
  @Exportable<SupplierPerformanceRow>("supplier-performance", [
    { header: "Supplier", value: (r) => r.supplierName },
    { header: "Purchase orders", value: (r) => r.purchaseOrders },
    { header: "Open", value: (r) => r.openOrders },
    { header: "Closed", value: (r) => r.closedOrders },
    { header: "Spend (KES)", value: (r) => r.spendKes },
    { header: "Orders in other currencies", value: (r) => r.otherCurrencyOrders },
    { header: "Units ordered", value: (r) => r.unitsOrdered },
    { header: "Units received", value: (r) => r.unitsReceived },
    { header: "Fill rate (closed POs)", value: (r) => r.fillRate },
  ])
  async supplierPerformance(@Query() query: DateRangeQueryDto): Promise<SupplierPerformanceRow[]> {
    if (!query.from || !query.to) throw new BadRequestException("from and to are required (YYYY-MM-DD)");
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { status: { in: COMMITTED }, approvedAt: dateRange(query.from, query.to) },
      select: {
        supplierId: true,
        supplierName: true,
        status: true,
        currency: true,
        totalAmount: true,
        lines: { select: { quantityOrdered: true, quantityReceived: true } },
      },
    });
    return supplierPerformance(orders.map((po) => ({ ...po, totalAmount: Number(po.totalAmount) })));
  }
}
