import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Exportable, Role, Roles } from "@mms/shared";
import { Product } from "../generated/prisma";
import { CreateProductDto } from "./dto/create-product.dto";
import { SetBinLocationDto } from "./dto/set-bin-location.dto";
import { StockAdjustmentDto } from "./dto/stock-adjustment.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ListProductsQuery } from "./list-products.query";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Exportable<Product>("products", [
    { header: "SKU", value: (p) => p.sku },
    { header: "Name", value: (p) => p.name },
    { header: "Category", value: (p) => p.category },
    { header: "Unit cost (KES)", value: (p) => Number(p.unitCost) },
    { header: "Length (cm)", value: (p) => (p.lengthCm === null ? null : Number(p.lengthCm)) },
    { header: "Width (cm)", value: (p) => (p.widthCm === null ? null : Number(p.widthCm)) },
    { header: "Height (cm)", value: (p) => (p.heightCm === null ? null : Number(p.heightCm)) },
    { header: "Weight (kg)", value: (p) => (p.weightKg === null ? null : Number(p.weightKg)) },
  ])
  list(@Query() query: ListProductsQuery) {
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

  /** FR-5.7 — Warehouse Operations confirms the final bin location after putaway. */
  @Put(":sku/bin-locations/:binCode")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  setBinLocation(
    @Param("sku") sku: string,
    @Param("binCode") binCode: string,
    @Body() dto: SetBinLocationDto,
  ) {
    return this.products.setBinLocation(sku, binCode, dto);
  }

  @Post(":sku/adjustments")
  @Roles(Role.OWNER, Role.MANAGER)
  adjust(@CurrentUser() user: AuthUser, @Param("sku") sku: string, @Body() dto: StockAdjustmentDto) {
    return this.products.adjust(sku, dto, user.id);
  }
}
