import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      include: { promotions: true },
      orderBy: { sku: "asc" },
    });
  }

  findBySku(sku: string) {
    return this.prisma.product.findUnique({
      where: { sku },
      include: { promotions: true },
    });
  }

  create(data: Prisma.ProductCreateArgs["data"]) {
    return this.prisma.product.create({ data });
  }

  update(sku: string, data: Prisma.ProductUpdateArgs["data"]) {
    return this.prisma.product.update({ where: { sku }, data });
  }

  createPromotion(data: Prisma.PromotionCreateArgs["data"]) {
    return this.prisma.promotion.create({ data });
  }
}
