import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { SetBinLocationDto } from "./dto/set-bin-location.dto";
import { StockAdjustmentDto } from "./dto/stock-adjustment.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  list() {
    return this.prisma.product.findMany({ orderBy: { name: "asc" } });
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  /** Also serves FR-4.7 — Warehouse Operations' item-attribute lookup. */
  async findOne(sku: string) {
    const product = await this.prisma.product.findUnique({ where: { sku } });
    if (!product) {
      throw new NotFoundException(`Product ${sku} not found`);
    }

    const [stockLevels, salesVelocity, binLocations] = await Promise.all([
      this.stock.getStockLevelsForSku(sku),
      this.prisma.salesVelocity.findFirst({
        where: { productId: product.id },
        orderBy: { computedAt: "desc" },
      }),
      this.prisma.binLocation.findMany({
        where: { productId: product.id },
        orderBy: { binCode: "asc" },
      }),
    ]);

    return { ...product, stockLevels, salesVelocity, binLocations };
  }

  async update(sku: string, dto: UpdateProductDto) {
    await this.ensureExists(sku);
    return this.prisma.product.update({ where: { sku }, data: dto });
  }

  adjust(sku: string, dto: StockAdjustmentDto) {
    return this.stock.adjust(sku, dto.locationCode, dto.quantityDelta, dto.reason);
  }

  /**
   * FR-5.7 — records where a product sits, as reported by Warehouse Operations.
   * Sets the bin's absolute quantity (idempotent); an empty bin's row is removed.
   */
  async setBinLocation(sku: string, binCode: string, dto: SetBinLocationDto) {
    const product = await this.prisma.product.findUnique({ where: { sku } });
    if (!product) {
      throw new NotFoundException(`Product ${sku} not found`);
    }

    const where = { productId_binCode: { productId: product.id, binCode } };
    if (dto.quantity === 0) {
      await this.prisma.binLocation.deleteMany({
        where: { productId: product.id, binCode },
      });
      return { sku, binCode, locationCode: dto.locationCode, quantity: 0 };
    }

    return this.prisma.binLocation.upsert({
      where,
      create: {
        productId: product.id,
        binCode,
        locationCode: dto.locationCode,
        quantity: dto.quantity,
      },
      update: { locationCode: dto.locationCode, quantity: dto.quantity },
    });
  }

  private async ensureExists(sku: string): Promise<void> {
    const count = await this.prisma.product.count({ where: { sku } });
    if (count === 0) {
      throw new NotFoundException(`Product ${sku} not found`);
    }
  }
}
