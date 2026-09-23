import { randomUUID } from "crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EventBusService,
  EventRoutingKey,
  GoodsReceivedEvent,
  PurchaseOrderApprovedEvent,
} from "@mms/shared";
import { PurchaseOrderStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { VendorManagementClientService } from "../vendor-management-client/vendor-management-client.service";
import { ApprovePurchaseOrderDto, ApproverRole } from "./dto/approve-purchase-order.dto";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";

const OPEN_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.APPROVED,
  PurchaseOrderStatus.SENT,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
];

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);
  private readonly approvalThresholdKes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorManagement: VendorManagementClientService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
  ) {
    this.approvalThresholdKes = Number(
      this.config.get<string>("PO_APPROVAL_THRESHOLD_KES") ?? 100000,
    );
  }

  list(status?: PurchaseOrderStatus) {
    return this.prisma.purchaseOrder.findMany({
      where: status ? { status } : undefined,
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    return po;
  }

  /** Server side of FR-3.1 — Receiving calls this to validate an open PO exists. */
  async findByPoNumber(poNumber: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { poNumber },
      include: { lines: true },
    });
    if (!po || !OPEN_STATUSES.includes(po.status)) {
      throw new NotFoundException(`No open, approved PO ${poNumber}`);
    }
    return po;
  }

  /** FR-2.1/FR-2.2 — prices and freezes a draft PO from Vendor Management's live offer. */
  async create(dto: CreatePurchaseOrderDto) {
    const pricedLines = await Promise.all(
      dto.lines.map(async (line) => {
        const offers = await this.vendorManagement.findSuppliersForSku(line.sku);
        const offer = offers.find((o) => o.supplierId === dto.supplierId);
        if (!offer) {
          throw new BadRequestException(
            `Supplier ${dto.supplierId} is not authorized to supply SKU ${line.sku}`,
          );
        }
        return { ...line, offer };
      }),
    );

    const [{ offer: firstOffer }] = pricedLines;
    const totalAmount = pricedLines.reduce(
      (sum, line) => sum + line.offer.unitCost * line.quantityOrdered,
      0,
    );

    // Pull the next value of the same Postgres sequence backing
    // PurchaseOrder.sequence so poNumber can be set in a single insert
    // instead of insert-then-update.
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('"PurchaseOrder"', 'sequence')) AS nextval
    `;
    const sequence = Number(nextval);
    const poNumber = `PO-${1000 + sequence}`;

    return this.prisma.purchaseOrder.create({
      data: {
        sequence,
        poNumber,
        supplierId: dto.supplierId,
        supplierName: firstOffer.supplierName,
        paymentTermsDays: firstOffer.paymentTermsDays,
        currency: firstOffer.currency,
        totalAmount,
        requestedById: dto.requestedById,
        lines: {
          create: pricedLines.map((line) => ({
            sku: line.sku,
            productName: line.offer.productName,
            quantityOrdered: line.quantityOrdered,
            unitCost: line.offer.unitCost,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async submit(id: string) {
    const po = await this.findOne(id);
    this.assertStatus(po, PurchaseOrderStatus.DRAFT);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.PENDING_APPROVAL },
      include: { lines: true },
    });
  }

  /** FR-2.3/D-1 — value-based approval threshold, then publishes PurchaseOrderApproved (FR-2.6). */
  async approve(id: string, dto: ApprovePurchaseOrderDto) {
    const po = await this.findOne(id);
    this.assertStatus(po, PurchaseOrderStatus.PENDING_APPROVAL);

    if (
      Number(po.totalAmount) >= this.approvalThresholdKes &&
      dto.approverRole !== ApproverRole.OWNER
    ) {
      throw new ForbiddenException(
        `POs at or above ${this.approvalThresholdKes} require OWNER approval (D-1)`,
      );
    }

    const approvedAt = new Date();
    const approved = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedById: dto.approvedById,
        approvedAt,
      },
      include: { lines: true },
    });

    const event: PurchaseOrderApprovedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      poNumber: approved.poNumber,
      supplierId: approved.supplierId,
      supplierName: approved.supplierName,
      paymentTermsDays: approved.paymentTermsDays,
      currency: approved.currency,
      approvedById: dto.approvedById,
      approvedAt: approvedAt.toISOString(),
      lines: approved.lines.map((line) => ({
        sku: line.sku,
        productName: line.productName,
        quantityOrdered: line.quantityOrdered,
        unitCost: Number(line.unitCost),
      })),
    };
    await this.eventBus.publish(EventRoutingKey.PURCHASE_ORDER_APPROVED, event);

    return approved;
  }

  /**
   * FR-2.5 / D-6 — applies a GoodsReceived event to the PO it references:
   * adds what arrived to each line's running total and moves the PO to
   * PARTIALLY_RECEIVED, or CLOSED once every line is fully received.
   * Idempotent per GRN, since the bus may redeliver. Only quantities are read
   * from the event; Procurement still never handles the goods themselves.
   */
  async applyGoodsReceived(event: GoodsReceivedEvent): Promise<void> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { poNumber: event.poNumber },
      include: { lines: true },
    });
    if (!po) {
      this.logger.warn(
        `GoodsReceived ${event.goodsReceivedNoteNumber} references unknown PO ${event.poNumber} — skipping`,
      );
      return;
    }

    const arrivedBySku = new Map<string, number>();
    for (const line of event.lines) {
      arrivedBySku.set(
        line.sku,
        (arrivedBySku.get(line.sku) ?? 0) + line.quantityReceived,
      );
    }

    const receivedAfter = po.lines.map((line) => ({
      id: line.id,
      quantityOrdered: line.quantityOrdered,
      quantityReceived:
        line.quantityReceived + (arrivedBySku.get(line.sku) ?? 0),
    }));
    const fullyReceived = receivedAfter.every(
      (line) => line.quantityReceived >= line.quantityOrdered,
    );
    // A PO already CLOSED keeps its status; late overage only updates totals.
    const nextStatus =
      po.status === PurchaseOrderStatus.CLOSED
        ? PurchaseOrderStatus.CLOSED
        : fullyReceived
          ? PurchaseOrderStatus.CLOSED
          : PurchaseOrderStatus.PARTIALLY_RECEIVED;

    try {
      await this.prisma.$transaction([
        // Unique on goodsReceivedNoteNumber: a redelivered event fails here and rolls back.
        this.prisma.processedGoodsReceipt.create({
          data: { goodsReceivedNoteNumber: event.goodsReceivedNoteNumber, poNumber: event.poNumber },
        }),
        ...receivedAfter.map((line) =>
          this.prisma.purchaseOrderLine.update({
            where: { id: line.id },
            data: { quantityReceived: line.quantityReceived },
          }),
        ),
        this.prisma.purchaseOrder.update({
          where: { id: po.id },
          data: { status: nextStatus },
        }),
      ]);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        this.logger.log(`GRN ${event.goodsReceivedNoteNumber} already applied to ${event.poNumber} — skipping`);
        return;
      }
      throw error;
    }
  }

  async markSent(id: string) {
    const po = await this.findOne(id);
    this.assertStatus(po, PurchaseOrderStatus.APPROVED);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SENT },
      include: { lines: true },
    });
  }

  private assertStatus(
    po: { status: PurchaseOrderStatus },
    expected: PurchaseOrderStatus,
  ): void {
    if (po.status !== expected) {
      throw new BadRequestException(
        `Expected PO status ${expected} but found ${po.status}`,
      );
    }
  }
}
