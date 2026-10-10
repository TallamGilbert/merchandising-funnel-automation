import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Exportable, ListQueryDto, Role, Roles } from "@mms/shared";
import { Product } from "../generated/prisma";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreatePromotionDto } from "./dto/create-promotion.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Exportable<Product>("price-list", [
    { header: "SKU", value: (p) => p.sku },
    { header: "Name", value: (p) => p.name },
    { header: "Unit price (KES)", value: (p) => Number(p.unitPrice) },
    { header: "VAT %", value: (p) => Number(p.taxRatePct) },
  ])
  list(@Query() query: ListQueryDto) {
    return this.products.list(query);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Get(":sku")
  findOne(@Param("sku") sku: string) {
    return this.products.findOne(sku);
  }

  @Patch(":sku")
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param("sku") sku: string, @Body() dto: UpdateProductDto) {
    return this.products.update(sku, dto);
  }

  @Post(":sku/promotions")
  @Roles(Role.OWNER, Role.MANAGER)
  addPromotion(@Param("sku") sku: string, @Body() dto: CreatePromotionDto) {
    return this.products.addPromotion(sku, dto);
  }
}
