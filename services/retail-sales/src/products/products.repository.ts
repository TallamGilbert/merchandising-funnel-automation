import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPage(where: Prisma.ProductWhereInput, page: { skip: number; take: number }) {
    return this.prisma.product.findMany({
      where,
      include: { promotions: true },
      orderBy: { sku: "asc" },
      ...page,
    });
  }

  count(where: Prisma.ProductWhereInput) {
    return this.prisma.product.count({ where });
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
