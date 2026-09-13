import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SupplierStatus } from "../generated/prisma";
import { CreateSupplierDeliveryRecordDto } from "./dto/create-delivery-record.dto";
import { CreateSupplierProductDto } from "./dto/create-supplier-product.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierProductDto } from "./dto/update-supplier-product.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("suppliers")
@Controller()
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get("suppliers")
  list(@Query("status") status?: SupplierStatus) {
    return this.suppliers.list(status);
  }

  @Post("suppliers")
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliers.create(dto);
  }

  @Get("suppliers/by-sku/:sku")
  findSuppliersForSku(@Param("sku") sku: string) {
    return this.suppliers.findSuppliersForSku(sku);
  }

  @Get("suppliers/:id")
  findOne(@Param("id") id: string) {
    return this.suppliers.findOne(id);
  }

  @Patch("suppliers/:id")
  update(@Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(id, dto);
  }

  @Post("suppliers/:id/archive")
  archive(@Param("id") id: string) {
    return this.suppliers.archive(id);
  }

  @Post("suppliers/:id/products")
  addProduct(
    @Param("id") id: string,
    @Body() dto: CreateSupplierProductDto,
  ) {
    return this.suppliers.addProduct(id, dto);
  }

  @Patch("suppliers/:id/products/:productId")
  updateProduct(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateSupplierProductDto,
  ) {
    return this.suppliers.updateProduct(id, productId, dto);
  }

  @Get("suppliers/:id/delivery-records")
  listDeliveryRecords(@Param("id") id: string) {
    return this.suppliers.listDeliveryRecords(id);
  }

  @Post("suppliers/:id/delivery-records")
  addDeliveryRecord(
    @Param("id") id: string,
    @Body() dto: CreateSupplierDeliveryRecordDto,
  ) {
    return this.suppliers.addDeliveryRecord(id, dto);
  }
}
