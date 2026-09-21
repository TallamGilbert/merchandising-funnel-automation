import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { CreateProductDto } from "./dto/create-product.dto";
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

    const [stockLevels, salesVelocity] = await Promise.all([
      this.stock.getStockLevelsForSku(sku),
      this.prisma.salesVelocity.findFirst({
        where: { productId: product.id },
        orderBy: { computedAt: "desc" },
      }),
    ]);

    return { ...product, stockLevels, salesVelocity };
  }

  async update(sku: string, dto: UpdateProductDto) {
    await this.ensureExists(sku);
    return this.prisma.product.update({ where: { sku }, data: dto });
  }

  adjust(sku: string, dto: StockAdjustmentDto) {
    return this.stock.adjust(sku, dto.locationCode, dto.quantityDelta, dto.reason);
  }

  private async ensureExists(sku: string): Promise<void> {
    const count = await this.prisma.product.count({ where: { sku } });
    if (count === 0) {
      throw new NotFoundException(`Product ${sku} not found`);
    }
  }
}
