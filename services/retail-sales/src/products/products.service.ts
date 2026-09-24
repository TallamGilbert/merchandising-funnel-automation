import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreatePromotionDto } from "./dto/create-promotion.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

export interface PricedProduct {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  taxRatePct: number;
  activePromotion: { discountPct: number } | null;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.product.findMany({
      include: { promotions: true },
      orderBy: { sku: "asc" },
    });
  }

  async findOne(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { promotions: true },
    });
    if (!product) throw new NotFoundException(`Product ${sku} not found`);
    return product;
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        unitPrice: dto.unitPrice,
        taxRatePct: dto.taxRatePct ?? 0,
      },
    });
  }

  async update(sku: string, dto: UpdateProductDto) {
    await this.findOne(sku);
    return this.prisma.product.update({ where: { sku }, data: dto });
  }

  async addPromotion(sku: string, dto: CreatePromotionDto) {
    const product = await this.findOne(sku);
    return this.prisma.promotion.create({
      data: {
        productId: product.id,
        discountPct: dto.discountPct,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
      },
    });
  }

  /**
   * FR-6.1 — current price and (if any) active promotion for one SKU, as
   * checkout needs it. `at` defaults to now; accepted as a parameter so a
   * whole checkout prices every line against the same instant.
   */
  async getActivePriceAndPromotion(sku: string, at: Date = new Date()): Promise<PricedProduct> {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { promotions: true },
    });
    if (!product) throw new NotFoundException(`Product ${sku} not found`);

    const activePromotion = product.promotions.find(
      (promo) => promo.startsAt <= at && promo.endsAt >= at,
    );

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      unitPrice: Number(product.unitPrice),
      taxRatePct: Number(product.taxRatePct),
      activePromotion: activePromotion
        ? { discountPct: Number(activePromotion.discountPct) }
        : null,
    };
  }
}
