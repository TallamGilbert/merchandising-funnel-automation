import { Injectable, NotFoundException } from "@nestjs/common";
import { DateRangeQueryDto, dateRange, ListQueryDto, pageArgs, paged, searchAny } from "@mms/shared";
import { SupplierStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDeliveryRecordDto } from "./dto/create-delivery-record.dto";
import { CreateSupplierProductDto } from "./dto/create-supplier-product.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { ListSuppliersQuery } from "./dto/list-suppliers.query";
import { UpdateSupplierProductDto } from "./dto/update-supplier-product.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { onTimePerformance } from "./on-time";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListSuppliersQuery) {
    const where = { status: query.status, ...searchAny(query.q, ["name", "contactName", "email"]) };
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({ where, orderBy: { name: "asc" }, ...pageArgs(query) }),
      this.prisma.supplier.count({ where }),
    ]);
    return paged(items, total, query);
  }

  /** D-20 — on-time delivery per supplier for deliveries made between from and to. */
  async onTime(query: DateRangeQueryDto) {
    const deliveries = await this.prisma.supplierDeliveryRecord.findMany({
      where: { actualDeliveryDate: dateRange(query.from, query.to) },
      select: {
        supplierId: true,
        expectedDate: true,
        actualDeliveryDate: true,
        onTime: true,
        supplier: { select: { name: true } },
      },
    });
    return onTimePerformance(deliveries.map(({ supplier, ...d }) => ({ ...d, supplierName: supplier.name })));
  }

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { products: true, deliveryRecords: true },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }

    const { deliveryRecords, ...rest } = supplier;
    const onTimeDeliveryRate =
      deliveryRecords.length === 0
        ? null
        : deliveryRecords.filter((record) => record.onTime).length /
          deliveryRecords.length;

    return { ...rest, onTimeDeliveryRate };
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.assertSupplierExistsOrThrow(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async archive(id: string) {
    await this.assertSupplierExistsOrThrow(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.ARCHIVED },
    });
  }

  async addProduct(supplierId: string, dto: CreateSupplierProductDto) {
    await this.assertSupplierExistsOrThrow(supplierId);
    return this.prisma.supplierProduct.create({
      data: { ...dto, supplierId },
    });
  }

  async updateProduct(
    supplierId: string,
    productId: string,
    dto: UpdateSupplierProductDto,
  ) {
    const product = await this.prisma.supplierProduct.findUnique({
      where: { id: productId },
    });
    if (!product || product.supplierId !== supplierId) {
      throw new NotFoundException(
        `Product ${productId} not found for supplier ${supplierId}`,
      );
    }
    return this.prisma.supplierProduct.update({
      where: { id: productId },
      data: dto,
    });
  }

  /** FR-1.5 — Procurement's lookup when building a PO. */
  async findSuppliersForSku(sku: string) {
    const offers = await this.prisma.supplierProduct.findMany({
      where: { sku, supplier: { status: SupplierStatus.ACTIVE } },
      include: { supplier: true },
    });

    return offers.map((offer) => ({
      supplierId: offer.supplierId,
      supplierName: offer.supplier.name,
      sku: offer.sku,
      productName: offer.productName,
      unitCost: offer.unitCost,
      currency: offer.currency,
      paymentTermsDays: offer.supplier.paymentTermsDays,
    }));
  }

  /** `q` matches the PO reference. */
  async listDeliveryRecords(supplierId: string, query: ListQueryDto) {
    await this.assertSupplierExistsOrThrow(supplierId);
    const where = { supplierId, ...searchAny(query.q, ["poReference"]) };
    const [items, total] = await Promise.all([
      this.prisma.supplierDeliveryRecord.findMany({
        where,
        orderBy: { actualDeliveryDate: "desc" },
        ...pageArgs(query),
      }),
      this.prisma.supplierDeliveryRecord.count({ where }),
    ]);
    return paged(items, total, query);
  }

  async addDeliveryRecord(
    supplierId: string,
    dto: CreateSupplierDeliveryRecordDto,
  ) {
    await this.assertSupplierExistsOrThrow(supplierId);
    const expectedDate = new Date(dto.expectedDate);
    const actualDeliveryDate = new Date(dto.actualDeliveryDate);

    return this.prisma.supplierDeliveryRecord.create({
      data: {
        supplierId,
        poReference: dto.poReference,
        expectedDate,
        actualDeliveryDate,
        onTime: actualDeliveryDate.getTime() <= expectedDate.getTime(),
      },
    });
  }

  private async assertSupplierExistsOrThrow(id: string): Promise<void> {
    const count = await this.prisma.supplier.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
  }
}
