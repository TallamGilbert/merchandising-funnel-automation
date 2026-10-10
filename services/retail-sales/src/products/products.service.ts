import { Injectable, NotFoundException } from "@nestjs/common";
import { ListQueryDto, pageArgs, paged, searchAny } from "@mms/shared";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreatePromotionDto } from "./dto/create-promotion.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsRepository } from "./products.repository";

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
  constructor(private readonly products: ProductsRepository) {}

  /** `q` matches the SKU or name. */
  async list(query: ListQueryDto) {
    const where = searchAny(query.q, ["sku", "name"]) ?? {};
    const [items, total] = await Promise.all([
      this.products.findPage(where, pageArgs(query)),
      this.products.count(where),
    ]);
    return paged(items, total, query);
  }

  async findOne(sku: string) {
    const product = await this.products.findBySku(sku);
    if (!product) throw new NotFoundException(`Product ${sku} not found`);
    return product;
  }

  create(dto: CreateProductDto) {
    return this.products.create({
      sku: dto.sku,
      name: dto.name,
      unitPrice: dto.unitPrice,
      taxRatePct: dto.taxRatePct ?? 0,
    });
  }

  async update(sku: string, dto: UpdateProductDto) {
    await this.findOne(sku);
    return this.products.update(sku, dto);
  }

  async addPromotion(sku: string, dto: CreatePromotionDto) {
    const product = await this.findOne(sku);
    return this.products.createPromotion({
      productId: product.id,
      discountPct: dto.discountPct,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
    });
  }

  /**
   * FR-6.1 — current price and (if any) active promotion for one SKU, as
   * checkout needs it. `at` defaults to now; accepted as a parameter so a
   * whole checkout prices every line against the same instant.
   */
  async getActivePriceAndPromotion(sku: string, at: Date = new Date()): Promise<PricedProduct> {
    const product = await this.findOne(sku);

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
