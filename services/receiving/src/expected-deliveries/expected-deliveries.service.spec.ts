import { PurchaseOrderApprovedEvent } from "@mms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ExpectedDeliveriesService } from "./expected-deliveries.service";

describe("ExpectedDeliveriesService", () => {
  let service: ExpectedDeliveriesService;
  let prisma: { expectedDelivery: Record<string, jest.Mock> };

  const event: PurchaseOrderApprovedEvent = {
    eventId: "e1",
    occurredAt: "2026-09-21T08:00:00.000Z",
    poNumber: "PO-1001",
    supplierId: "supplier-1",
    supplierName: "Acme Furniture",
    paymentTermsDays: 30,
    currency: "KES",
    approvedById: "manager-1",
    approvedAt: "2026-09-21T08:00:00.000Z",
    lines: [{ sku: "SKU-1", productName: "Oak Chair", quantityOrdered: 10, unitCost: 1000 }],
  };

  beforeEach(() => {
    prisma = {
      expectedDelivery: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new ExpectedDeliveriesService(prisma as unknown as PrismaService);
  });

  it("records an expected delivery from PurchaseOrderApproved without any cost data", async () => {
    prisma.expectedDelivery.findUnique.mockResolvedValue(null);
    prisma.expectedDelivery.create.mockResolvedValue({ id: "ed-1" });

    await service.recordFromEvent(event);

    const { data } = prisma.expectedDelivery.create.mock.calls[0][0];
    expect(data).toEqual({
      poNumber: "PO-1001",
      supplierId: "supplier-1",
      supplierName: "Acme Furniture",
      lines: {
        create: [{ sku: "SKU-1", productName: "Oak Chair", quantityOrdered: 10 }],
      },
    });
  });

  it("is idempotent when the event is redelivered", async () => {
    prisma.expectedDelivery.findUnique.mockResolvedValue({ id: "ed-1" });

    await service.recordFromEvent(event);

    expect(prisma.expectedDelivery.create).not.toHaveBeenCalled();
  });
});
