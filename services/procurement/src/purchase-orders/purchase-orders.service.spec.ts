import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { PurchaseOrderStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { VendorManagementClientService } from "../vendor-management-client/vendor-management-client.service";
import { ApproverRole } from "./dto/approve-purchase-order.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

describe("PurchaseOrdersService", () => {
  let service: PurchaseOrdersService;
  let prisma: {
    purchaseOrder: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
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
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1) }]),
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
});
