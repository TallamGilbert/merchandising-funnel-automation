import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateProductDto } from "./dto/create-product.dto";
import { StockAdjustmentDto } from "./dto/stock-adjustment.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Get(":sku")
  findOne(@Param("sku") sku: string) {
    return this.products.findOne(sku);
  }

  @Patch(":sku")
  update(@Param("sku") sku: string, @Body() dto: UpdateProductDto) {
    return this.products.update(sku, dto);
  }

  @Post(":sku/adjustments")
  adjust(@Param("sku") sku: string, @Body() dto: StockAdjustmentDto) {
    return this.products.adjust(sku, dto);
  }
}
