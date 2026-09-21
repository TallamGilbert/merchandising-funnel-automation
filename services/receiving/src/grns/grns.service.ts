import { randomUUID } from "crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  GoodsReceivedEvent,
} from "@mms/shared";
import {
  ExpectedDeliveryStatus,
  GrnCondition,
  GrnStatus,
} from "../generated/prisma";
import { ExpectedDeliveriesService } from "../expected-deliveries/expected-deliveries.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProcurementClientService } from "../procurement-client/procurement-client.service";
import { CreateGrnDto } from "./dto/create-grn.dto";
import { RecordScanDto } from "./dto/record-scan.dto";
import { discrepancyFor } from "./discrepancy";

@Injectable()
export class GrnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly procurement: ProcurementClientService,
    private readonly expectedDeliveries: ExpectedDeliveriesService,
    private readonly eventBus: EventBusService,
  ) {}

  list(status?: GrnStatus) {
    return this.prisma.grn.findMany({
      where: status ? { status } : undefined,
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const grn = await this.prisma.grn.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!grn) throw new NotFoundException(`GRN ${id} not found`);
    return grn;
  }

  /**
   * FR-3.1 — opens a draft GRN for an arriving truck. Procurement confirms
   * an open, approved PO exists; the GRN is then pre-populated with one GOOD
   * line per SKU still outstanding, using Receiving's own running totals
   * (Procurement does not track received quantity).
   */
  async create(dto: CreateGrnDto) {
    const po = await this.procurement.findOpenPo(dto.poNumber);
    const expected = await this.expectedDeliveries.recordFromProcurement(po);

    const outstanding = expected.lines.filter(
      (line) => line.quantityOrdered - line.quantityReceived > 0,
    );
    if (outstanding.length === 0) {
      throw new BadRequestException(
        `PO ${po.poNumber} has already been fully received`,
      );
    }

    // Pull the next value of the same Postgres sequence backing Grn.sequence
    // so grnNumber can be set in a single insert.
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('"Grn"', 'sequence')) AS nextval
    `;
    const sequence = Number(nextval);

    return this.prisma.grn.create({
      data: {
        sequence,
        grnNumber: `GRN-${1000 + sequence}`,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        receivedAtLocation: dto.receivedAtLocation,
        receivedById: dto.receivedById,
        lines: {
          create: outstanding.map((line) => ({
            sku: line.sku,
            productName: line.productName,
            quantityOrdered: line.quantityOrdered - line.quantityReceived,
            condition: GrnCondition.GOOD,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /**
   * FR-3.2/3.3/3.4/3.8 — one barcode scan. Quantities accumulate per
   * (sku, condition); the SKU's discrepancies are recomputed straight away so
   * the dock app can flag them at time of scan. DAMAGED scans land on a
   * quarantined line and never count towards sellable stock.
   */
  async recordScan(id: string, dto: RecordScanDto) {
    const grn = await this.findOne(id);
    this.assertDraft(grn);

    const skuLines = grn.lines.filter((line) => line.sku === dto.sku);
    const productName = skuLines[0]?.productName ?? dto.sku;
    const isDamaged = dto.condition === GrnCondition.DAMAGED;

    await this.prisma.grnLine.upsert({
      where: {
        grnId_sku_condition: { grnId: id, sku: dto.sku, condition: dto.condition },
      },
      create: {
        grnId: id,
        sku: dto.sku,
        productName,
        // Only the GOOD line carries the ordered quantity; a DAMAGED line or a
        // SKU that is not on the PO starts at 0.
        quantityOrdered: 0,
        quantityReceived: dto.quantity,
        condition: dto.condition,
        quarantined: isDamaged,
        notes: dto.notes,
      },
      update: {
        quantityReceived: { increment: dto.quantity },
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
    });

    const refreshed = await this.findOne(id);
    await Promise.all(
      refreshed.lines
        .filter((line) => line.sku === dto.sku)
        .map((line) =>
          this.prisma.grnLine.update({
            where: { id: line.id },
            data: { discrepancyType: discrepancyFor(line, refreshed.lines) },
          }),
        ),
    );

    return this.findOne(id);
  }

  /** FR-3.5/3.6 — freezes the GRN, updates running totals, publishes GoodsReceived. */
  async finalize(id: string) {
    const grn = await this.findOne(id);
    this.assertDraft(grn);
    if (!grn.lines.some((line) => line.quantityReceived > 0)) {
      throw new BadRequestException("Nothing has been scanned on this GRN yet");
    }

    const expected = await this.expectedDeliveries.findByPoNumber(grn.poNumber);
    const arrivedBySku = new Map<string, number>();
    for (const line of grn.lines) {
      arrivedBySku.set(
        line.sku,
        (arrivedBySku.get(line.sku) ?? 0) + line.quantityReceived,
      );
    }

    const updatedExpectedLines = expected.lines.map((line) => ({
      ...line,
      quantityReceived:
        line.quantityReceived + (arrivedBySku.get(line.sku) ?? 0),
    }));
    const fullyReceived = updatedExpectedLines.every(
      (line) => line.quantityReceived >= line.quantityOrdered,
    );

    const finalizedLines = grn.lines.map((line) => ({
      ...line,
      discrepancyType: discrepancyFor(line, grn.lines),
    }));

    const [finalized] = await this.prisma.$transaction([
      this.prisma.grn.update({
        where: { id },
        data: { status: GrnStatus.FINALIZED, finalizedAt: new Date() },
        include: { lines: true },
      }),
      ...finalizedLines.map((line) =>
        this.prisma.grnLine.update({
          where: { id: line.id },
          data: { discrepancyType: line.discrepancyType },
        }),
      ),
      ...updatedExpectedLines.map((line) =>
        this.prisma.expectedDeliveryLine.update({
          where: { id: line.id },
          data: { quantityReceived: line.quantityReceived },
        }),
      ),
      this.prisma.expectedDelivery.update({
        where: { id: expected.id },
        data: {
          status: fullyReceived
            ? ExpectedDeliveryStatus.RECEIVED
            : ExpectedDeliveryStatus.PARTIALLY_RECEIVED,
        },
      }),
    ]);

    // Physical facts only — no unit cost. Financials reads the frozen cost
    // from Procurement by poNumber (see GoodsReceivedEvent).
    const event: GoodsReceivedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      grnNumber: grn.grnNumber,
      poNumber: grn.poNumber,
      supplierId: grn.supplierId,
      receivedAtLocation: grn.receivedAtLocation,
      lines: finalizedLines.map((line) => ({
        sku: line.sku,
        productName: line.productName,
        quantityOrdered: line.quantityOrdered,
        quantityReceived: line.quantityReceived,
        condition: line.condition,
        discrepancyType: line.discrepancyType,
      })),
    };
    await this.eventBus.publish(EventRoutingKey.GOODS_RECEIVED, event);

    return { ...finalized, lines: finalizedLines };
  }

  private assertDraft(grn: { status: GrnStatus }): void {
    if (grn.status !== GrnStatus.DRAFT) {
      throw new BadRequestException(
        `GRN is ${grn.status} and can no longer be changed`,
      );
    }
  }
}
