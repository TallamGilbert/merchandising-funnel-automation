import { Injectable, NotFoundException } from "@nestjs/common";
import { PurchaseOrderApprovedEvent } from "@mms/shared";
import { ExpectedDeliveryStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { OpenPurchaseOrder } from "../procurement-client/procurement-client.service";

@Injectable()
export class ExpectedDeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: ExpectedDeliveryStatus) {
    return this.prisma.expectedDelivery.findMany({
      where: status ? { status } : undefined,
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByPoNumber(poNumber: string) {
    const delivery = await this.prisma.expectedDelivery.findUnique({
      where: { poNumber },
      include: { lines: true },
    });
    if (!delivery) {
      throw new NotFoundException(`No expected delivery for PO ${poNumber}`);
    }
    return delivery;
  }

  /** FR-3.7 — records a delivery to expect. Idempotent, since the bus may redeliver. */
  async recordFromEvent(event: PurchaseOrderApprovedEvent) {
    return this.record({
      poNumber: event.poNumber,
      supplierId: event.supplierId,
      supplierName: event.supplierName,
      lines: event.lines,
    });
  }

  /**
   * Returns the existing expected delivery, or seeds one from Procurement's
   * answer when a GRN is opened for a PO whose PurchaseOrderApproved event
   * never reached us (e.g. Receiving was deployed after the PO was approved).
   */
  async recordFromProcurement(po: OpenPurchaseOrder) {
    return this.record(po);
  }

  private async record(po: OpenPurchaseOrder) {
    const existing = await this.prisma.expectedDelivery.findUnique({
      where: { poNumber: po.poNumber },
      include: { lines: true },
    });
    if (existing) return existing;

    return this.prisma.expectedDelivery.create({
      data: {
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        lines: {
          create: po.lines.map((line) => ({
            sku: line.sku,
            productName: line.productName,
            quantityOrdered: line.quantityOrdered,
          })),
        },
      },
      include: { lines: true },
    });
  }
}
