import { NotFoundException } from "@nestjs/common";
import { SupplierStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { SuppliersService } from "./suppliers.service";

describe("SuppliersService", () => {
  let service: SuppliersService;
  let prisma: {
    supplier: Record<string, jest.Mock>;
    supplierProduct: Record<string, jest.Mock>;
    supplierDeliveryRecord: Record<string, jest.Mock>;
  };

  beforeEach(() => {
    prisma = {
      supplier: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      supplierProduct: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      supplierDeliveryRecord: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new SuppliersService(prisma as unknown as PrismaService);
  });

  it("creates a supplier", async () => {
    const dto = {
      name: "Acme Furniture",
      email: "sales@acme.example",
      paymentTermsDays: 30,
    };
    prisma.supplier.create.mockResolvedValue({ id: "s1", ...dto });

    const result = await service.create(dto);

    expect(prisma.supplier.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: "s1", ...dto });
  });

  it("paginates the supplier list and returns the total", async () => {
    prisma.supplier.findMany.mockResolvedValue([{ id: "s3" }]);
    prisma.supplier.count.mockResolvedValue(41);

    const result = await service.list(SupplierStatus.ACTIVE, {
      page: 3,
      pageSize: 20,
    });

    expect(prisma.supplier.findMany).toHaveBeenCalledWith({
      where: { status: SupplierStatus.ACTIVE },
      orderBy: { name: "asc" },
      skip: 40,
      take: 20,
    });
    expect(prisma.supplier.count).toHaveBeenCalledWith({
      where: { status: SupplierStatus.ACTIVE },
    });
    expect(result).toEqual({
      items: [{ id: "s3" }],
      total: 41,
      page: 3,
      pageSize: 20,
    });
  });

  it("paginates delivery records for a supplier", async () => {
    prisma.supplier.count.mockResolvedValue(1);
    prisma.supplierDeliveryRecord.findMany.mockResolvedValue([]);
    prisma.supplierDeliveryRecord.count.mockResolvedValue(0);

    const result = await service.listDeliveryRecords("s1", {
      page: 2,
      pageSize: 10,
    });

    expect(prisma.supplierDeliveryRecord.findMany).toHaveBeenCalledWith({
      where: { supplierId: "s1" },
      orderBy: { actualDeliveryDate: "desc" },
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
  });

  it("throws NotFoundException when archiving a missing supplier", async () => {
    prisma.supplier.count.mockResolvedValue(0);

    await expect(service.archive("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("computes onTimeDeliveryRate from delivery records", async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      id: "s1",
      name: "Acme Furniture",
      status: SupplierStatus.ACTIVE,
      products: [],
      deliveryRecords: [{ onTime: true }, { onTime: false }, { onTime: true }],
    });

    const result = await service.findOne("s1");

    expect(result.onTimeDeliveryRate).toBeCloseTo(2 / 3);
  });

  it("returns null onTimeDeliveryRate when there is no delivery history", async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      id: "s1",
      name: "Acme Furniture",
      status: SupplierStatus.ACTIVE,
      products: [],
      deliveryRecords: [],
    });

    const result = await service.findOne("s1");

    expect(result.onTimeDeliveryRate).toBeNull();
  });

  it("only offers active suppliers for a SKU lookup", async () => {
    prisma.supplierProduct.findMany.mockResolvedValue([
      {
        supplierId: "s1",
        sku: "SKU-1",
        productName: "Oak Dining Chair",
        unitCost: 100,
        currency: "KES",
        supplier: { name: "Acme Furniture", paymentTermsDays: 30 },
      },
    ]);

    const result = await service.findSuppliersForSku("SKU-1");

    expect(prisma.supplierProduct.findMany).toHaveBeenCalledWith({
      where: { sku: "SKU-1", supplier: { status: SupplierStatus.ACTIVE } },
      include: { supplier: true },
    });
    expect(result).toEqual([
      {
        supplierId: "s1",
        supplierName: "Acme Furniture",
        sku: "SKU-1",
        productName: "Oak Dining Chair",
        unitCost: 100,
        currency: "KES",
        paymentTermsDays: 30,
      },
    ]);
  });
});
