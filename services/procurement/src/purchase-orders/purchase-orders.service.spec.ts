import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventBusService, EventRoutingKey, GoodsReceivedEvent } from "@mms/shared";
import { PurchaseOrderStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { VendorManagementClientService } from "../vendor-management-client/vendor-management-client.service";
import { ApproverRole } from "./dto/approve-purchase-order.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

describe("PurchaseOrdersService", () => {
  let service: PurchaseOrdersService;
  let prisma: {
    purchaseOrder: Record<string, jest.Mock>;
    purchaseOrderLine: Record<string, jest.Mock>;
    processedGoodsReceipt: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let vendorManagement: { findSuppliersForSku: jest.Mock };
  let eventBus: { publish: jest.Mock };

  const offer = {
    supplierId: "supplier-1",
    supplierName: "Acme Furniture",
    sku: "SKU-1",
    productName: "Oak Dining Chair",
    unitCost: 1000,
    currency: "KES",
    paymentTermsDays: 30,
  };

  beforeEach(() => {
    prisma = {
      purchaseOrder: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrderLine: { update: jest.fn().mockReturnValue("line-update") },
      processedGoodsReceipt: { create: jest.fn().mockReturnValue("receipt-create") },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1) }]),
      $transaction: jest.fn(),
    };
    vendorManagement = { findSuppliersForSku: jest.fn().mockResolvedValue([offer]) };
    eventBus = { publish: jest.fn() };
    const config = { get: jest.fn().mockReturnValue("100000") };

    service = new PurchaseOrdersService(
      prisma as unknown as PrismaService,
      vendorManagement as unknown as VendorManagementClientService,
      eventBus as unknown as EventBusService,
      config as unknown as ConfigService,
    );
  });

  it("prices and freezes a PO from the supplier's current offer", async () => {
    prisma.purchaseOrder.create.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-1001",
      totalAmount: 2000,
      lines: [],
    });

    await service.create({
      supplierId: "supplier-1",
      requestedById: "buyer-1",
      lines: [{ sku: "SKU-1", quantityOrdered: 2 }],
    });

    expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poNumber: "PO-1001",
          supplierName: "Acme Furniture",
          paymentTermsDays: 30,
          totalAmount: 2000,
        }),
      }),
    );
  });

  it("rejects a PO line if the supplier isn't authorized for that SKU", async () => {
    vendorManagement.findSuppliersForSku.mockResolvedValue([]);

    await expect(
      service.create({
        supplierId: "supplier-1",
        requestedById: "buyer-1",
        lines: [{ sku: "SKU-1", quantityOrdered: 2 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks manager approval for a PO at/above the threshold (D-1)", async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      status: PurchaseOrderStatus.PENDING_APPROVAL,
      totalAmount: 150000,
      lines: [],
    });

    await expect(
      service.approve("po-1", {
        approvedById: "manager-1",
        approverRole: ApproverRole.MANAGER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("approves and publishes PurchaseOrderApproved when the role is sufficient", async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      status: PurchaseOrderStatus.PENDING_APPROVAL,
      totalAmount: 150000,
      lines: [],
    });
    prisma.purchaseOrder.update.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-1001",
      supplierId: "supplier-1",
      supplierName: "Acme Furniture",
      paymentTermsDays: 30,
      currency: "KES",
      status: PurchaseOrderStatus.APPROVED,
      approvedAt: new Date("2026-01-01T00:00:00.000Z"),
      lines: [],
    });

    await service.approve("po-1", {
      approvedById: "owner-1",
      approverRole: ApproverRole.OWNER,
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      EventRoutingKey.PURCHASE_ORDER_APPROVED,
      expect.objectContaining({ poNumber: "PO-1001", supplierId: "supplier-1" }),
    );
  });

  describe("applyGoodsReceived (FR-2.5, D-6)", () => {
    const receipt = (
      lines: { sku: string; quantityReceived: number; condition?: "GOOD" | "DAMAGED" }[],
    ): GoodsReceivedEvent => ({
      eventId: "e1",
      occurredAt: "2026-09-21T08:00:00.000Z",
      grnNumber: "GRN-1001",
      poNumber: "PO-1001",
      supplierId: "supplier-1",
      receivedAtLocation: "WH-MAIN",
      lines: lines.map((line) => ({
        sku: line.sku,
        productName: line.sku,
        quantityOrdered: 0,
        quantityReceived: line.quantityReceived,
        condition: line.condition ?? "GOOD",
        discrepancyType: "NONE",
      })),
    });
    const po = (status: PurchaseOrderStatus = PurchaseOrderStatus.SENT, received = 0) => ({
      id: "po-1",
      poNumber: "PO-1001",
      status,
      lines: [
        { id: "l1", sku: "SKU-1", quantityOrdered: 10, quantityReceived: received },
        { id: "l2", sku: "SKU-2", quantityOrdered: 4, quantityReceived: 0 },
      ],
    });

    it("moves the PO to PARTIALLY_RECEIVED and tracks what is still open", async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po());

      await service.applyGoodsReceived(receipt([{ sku: "SKU-1", quantityReceived: 6 }]));

      expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { quantityReceived: 6 },
      });
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: "po-1" },
        data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
      });
    });

    it("closes the PO once every line is fully received", async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(
        po(PurchaseOrderStatus.PARTIALLY_RECEIVED, 6),
      );

      await service.applyGoodsReceived(
        receipt([
          { sku: "SKU-1", quantityReceived: 4 },
          { sku: "SKU-2", quantityReceived: 4 },
        ]),
      );

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: "po-1" },
        data: { status: PurchaseOrderStatus.CLOSED },
      });
    });

    it("counts damaged units as arrived, matching Receiving's own tally", async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po());

      await service.applyGoodsReceived(
        receipt([
          { sku: "SKU-1", quantityReceived: 8 },
          { sku: "SKU-1", quantityReceived: 2, condition: "DAMAGED" },
        ]),
      );

      expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { quantityReceived: 10 },
      });
    });

    it("ignores SKUs that are not on the PO", async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po());

      await service.applyGoodsReceived(receipt([{ sku: "SKU-9", quantityReceived: 3 }]));

      expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { quantityReceived: 0 },
      });
    });

    it("skips a redelivered GRN instead of adding its quantities twice", async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po());
      prisma.$transaction.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

      await expect(
        service.applyGoodsReceived(receipt([{ sku: "SKU-1", quantityReceived: 6 }])),
      ).resolves.toBeUndefined();
    });

    it("rethrows unexpected database errors so the bus retries", async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po());
      prisma.$transaction.mockRejectedValue(new Error("connection lost"));

      await expect(
        service.applyGoodsReceived(receipt([{ sku: "SKU-1", quantityReceived: 6 }])),
      ).rejects.toThrow("connection lost");
    });

    it("skips an event for an unknown PO", async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await service.applyGoodsReceived(receipt([{ sku: "SKU-1", quantityReceived: 6 }]));

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
