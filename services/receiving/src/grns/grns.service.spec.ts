import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { GrnCondition, GrnDiscrepancyType, GrnStatus } from "../generated/prisma";
import { ExpectedDeliveriesService } from "../expected-deliveries/expected-deliveries.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProcurementClientService } from "../procurement-client/procurement-client.service";
import { discrepancyFor } from "./discrepancy";
import { GrnsService } from "./grns.service";

describe("discrepancyFor", () => {
  const line = (
    condition: GrnCondition,
    quantityOrdered: number,
    quantityReceived: number,
  ) => ({ sku: "SKU-1", condition, quantityOrdered, quantityReceived });

  it("flags a shortage when less arrived than ordered", () => {
    const lines = [line(GrnCondition.GOOD, 10, 7)];
    expect(discrepancyFor(lines[0], lines)).toBe(GrnDiscrepancyType.SHORTAGE);
  });

  it("flags an overage when more arrived than ordered", () => {
    const lines = [line(GrnCondition.GOOD, 10, 12)];
    expect(discrepancyFor(lines[0], lines)).toBe(GrnDiscrepancyType.OVERAGE);
  });

  it("flags damage on the DAMAGED line without also reporting a shortage on the GOOD line", () => {
    const lines = [line(GrnCondition.GOOD, 10, 8), line(GrnCondition.DAMAGED, 0, 2)];
    expect(discrepancyFor(lines[0], lines)).toBe(GrnDiscrepancyType.NONE);
    expect(discrepancyFor(lines[1], lines)).toBe(GrnDiscrepancyType.DAMAGE);
  });

  it("reports NONE when the delivery matches the order", () => {
    const lines = [line(GrnCondition.GOOD, 10, 10)];
    expect(discrepancyFor(lines[0], lines)).toBe(GrnDiscrepancyType.NONE);
  });
});

describe("GrnsService", () => {
  let service: GrnsService;
  let prisma: {
    grn: Record<string, jest.Mock>;
    grnLine: Record<string, jest.Mock>;
    expectedDeliveryLine: Record<string, jest.Mock>;
    expectedDelivery: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let procurement: { findOpenPo: jest.Mock };
  let expectedDeliveries: {
    recordFromProcurement: jest.Mock;
    findByPoNumber: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  const expected = {
    id: "ed-1",
    poNumber: "PO-1001",
    supplierId: "supplier-1",
    supplierName: "Acme Furniture",
    lines: [
      { id: "edl-1", sku: "SKU-1", productName: "Oak Chair", quantityOrdered: 10, quantityReceived: 0 },
    ],
  };

  beforeEach(() => {
    prisma = {
      grn: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockReturnValue("grn-update"),
      },
      grnLine: {
        upsert: jest.fn(),
        update: jest.fn().mockReturnValue("line-update"),
      },
      expectedDeliveryLine: { update: jest.fn().mockReturnValue("edl-update") },
      expectedDelivery: { update: jest.fn().mockReturnValue("ed-update") },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1) }]),
      $transaction: jest.fn(),
    };
    procurement = {
      findOpenPo: jest.fn().mockResolvedValue({
        poNumber: "PO-1001",
        supplierId: "supplier-1",
        supplierName: "Acme Furniture",
        lines: [{ sku: "SKU-1", productName: "Oak Chair", quantityOrdered: 10 }],
      }),
    };
    expectedDeliveries = {
      recordFromProcurement: jest.fn().mockResolvedValue(expected),
      findByPoNumber: jest.fn().mockResolvedValue(expected),
    };
    eventBus = { publish: jest.fn() };

    service = new GrnsService(
      prisma as unknown as PrismaService,
      procurement as unknown as ProcurementClientService,
      expectedDeliveries as unknown as ExpectedDeliveriesService,
      eventBus as unknown as EventBusService,
    );
  });

  describe("create", () => {
    const dto = { poNumber: "PO-1001", receivedAtLocation: "WH-MAIN", receivedById: "dock-1" };

    it("opens a draft GRN pre-populated with the outstanding quantity per SKU", async () => {
      prisma.grn.create.mockResolvedValue({ id: "grn-1" });

      await service.create(dto);

      expect(prisma.grn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grnNumber: "GRN-1001",
            poNumber: "PO-1001",
            supplierId: "supplier-1",
            receivedAtLocation: "WH-MAIN",
            lines: {
              create: [
                {
                  sku: "SKU-1",
                  productName: "Oak Chair",
                  quantityOrdered: 10,
                  condition: GrnCondition.GOOD,
                },
              ],
            },
          }),
        }),
      );
    });

    it("subtracts quantities already received on earlier GRNs", async () => {
      expectedDeliveries.recordFromProcurement.mockResolvedValue({
        ...expected,
        lines: [{ ...expected.lines[0], quantityReceived: 4 }],
      });
      prisma.grn.create.mockResolvedValue({ id: "grn-2" });

      await service.create(dto);

      const data = prisma.grn.create.mock.calls[0][0].data;
      expect(data.lines.create[0].quantityOrdered).toBe(6);
    });

    it("rejects a PO that has already been fully received", async () => {
      expectedDeliveries.recordFromProcurement.mockResolvedValue({
        ...expected,
        lines: [{ ...expected.lines[0], quantityReceived: 10 }],
      });

      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.grn.create).not.toHaveBeenCalled();
    });

    it("propagates Procurement's 404 when no open PO exists", async () => {
      procurement.findOpenPo.mockRejectedValue(new NotFoundException());

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.grn.create).not.toHaveBeenCalled();
    });
  });

  describe("recordScan", () => {
    const draft = (lines: object[]) => ({
      id: "grn-1",
      status: GrnStatus.DRAFT,
      lines,
    });

    it("accumulates a DAMAGED scan onto a quarantined line", async () => {
      const goodLine = {
        id: "l1", sku: "SKU-1", productName: "Oak Chair",
        quantityOrdered: 10, quantityReceived: 8, condition: GrnCondition.GOOD,
      };
      const damagedLine = {
        id: "l2", sku: "SKU-1", productName: "Oak Chair",
        quantityOrdered: 0, quantityReceived: 2, condition: GrnCondition.DAMAGED,
      };
      prisma.grn.findUnique
        .mockResolvedValueOnce(draft([goodLine]))
        .mockResolvedValueOnce(draft([goodLine, damagedLine]))
        .mockResolvedValueOnce(draft([goodLine, damagedLine]));

      await service.recordScan("grn-1", {
        sku: "SKU-1", quantity: 2, condition: GrnCondition.DAMAGED,
      });

      expect(prisma.grnLine.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            productName: "Oak Chair",
            quantityOrdered: 0,
            quantityReceived: 2,
            quarantined: true,
          }),
          update: { quantityReceived: { increment: 2 } },
        }),
      );
      expect(prisma.grnLine.update).toHaveBeenCalledWith({
        where: { id: "l2" },
        data: { discrepancyType: GrnDiscrepancyType.DAMAGE },
      });
      expect(prisma.grnLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { discrepancyType: GrnDiscrepancyType.NONE },
      });
    });

    it("refuses to scan against a finalized GRN", async () => {
      prisma.grn.findUnique.mockResolvedValue({
        id: "grn-1", status: GrnStatus.FINALIZED, lines: [],
      });

      await expect(
        service.recordScan("grn-1", { sku: "SKU-1", quantity: 1, condition: GrnCondition.GOOD }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.grnLine.upsert).not.toHaveBeenCalled();
    });
  });

  describe("finalize", () => {
    const grn = (quantityReceived: number) => ({
      id: "grn-1",
      grnNumber: "GRN-1001",
      poNumber: "PO-1001",
      supplierId: "supplier-1",
      receivedAtLocation: "WH-MAIN",
      status: GrnStatus.DRAFT,
      lines: [
        {
          id: "l1", sku: "SKU-1", productName: "Oak Chair",
          quantityOrdered: 10, quantityReceived, condition: GrnCondition.GOOD,
          discrepancyType: GrnDiscrepancyType.NONE,
        },
      ],
    });

    it("rejects a GRN with nothing scanned", async () => {
      prisma.grn.findUnique.mockResolvedValue(grn(0));

      await expect(service.finalize("grn-1")).rejects.toBeInstanceOf(BadRequestException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("publishes GoodsReceived with physical facts only and marks a partial delivery", async () => {
      prisma.grn.findUnique.mockResolvedValue(grn(7));
      prisma.$transaction.mockResolvedValue([{ id: "grn-1", status: GrnStatus.FINALIZED }]);

      await service.finalize("grn-1");

      expect(prisma.expectedDeliveryLine.update).toHaveBeenCalledWith({
        where: { id: "edl-1" },
        data: { quantityReceived: 7 },
      });
      expect(prisma.expectedDelivery.update).toHaveBeenCalledWith({
        where: { id: "ed-1" },
        data: { status: "PARTIALLY_RECEIVED" },
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        EventRoutingKey.GOODS_RECEIVED,
        expect.objectContaining({
          grnNumber: "GRN-1001",
          poNumber: "PO-1001",
          supplierId: "supplier-1",
          receivedAtLocation: "WH-MAIN",
          lines: [
            {
              sku: "SKU-1",
              productName: "Oak Chair",
              quantityOrdered: 10,
              quantityReceived: 7,
              condition: GrnCondition.GOOD,
              discrepancyType: GrnDiscrepancyType.SHORTAGE,
            },
          ],
        }),
      );
      const event = eventBus.publish.mock.calls[0][1];
      expect(JSON.stringify(event)).not.toMatch(/cost|price/i);
    });

    it("marks the expected delivery RECEIVED once everything has arrived", async () => {
      prisma.grn.findUnique.mockResolvedValue(grn(10));
      prisma.$transaction.mockResolvedValue([{ id: "grn-1" }]);

      await service.finalize("grn-1");

      expect(prisma.expectedDelivery.update).toHaveBeenCalledWith({
        where: { id: "ed-1" },
        data: { status: "RECEIVED" },
      });
    });
  });
});
