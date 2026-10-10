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
import { Exportable, ListQueryDto, Role, Roles } from "@mms/shared";
import { Supplier, SupplierDeliveryRecord } from "../generated/prisma";
import { CreateSupplierDeliveryRecordDto } from "./dto/create-delivery-record.dto";
import { CreateSupplierProductDto } from "./dto/create-supplier-product.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierProductDto } from "./dto/update-supplier-product.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { ListSuppliersQuery } from "./dto/list-suppliers.query";
import { SuppliersService } from "./suppliers.service";

@ApiTags("suppliers")
@Controller()
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get("suppliers")
  @Exportable<Supplier>("suppliers", [
    { header: "Name", value: (s) => s.name },
    { header: "Contact", value: (s) => s.contactName },
    { header: "Email", value: (s) => s.email },
    { header: "Phone", value: (s) => s.phone },
    { header: "Address", value: (s) => s.address },
    { header: "Payment terms (days)", value: (s) => s.paymentTermsDays },
    { header: "Status", value: (s) => s.status },
    { header: "Added", value: (s) => s.createdAt },
  ])
  list(@Query() query: ListSuppliersQuery) {
    return this.suppliers.list(query);
  }

  @Post("suppliers")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
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
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  update(@Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(id, dto);
  }

  @Post("suppliers/:id/archive")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  archive(@Param("id") id: string) {
    return this.suppliers.archive(id);
  }

  @Post("suppliers/:id/products")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  addProduct(
    @Param("id") id: string,
    @Body() dto: CreateSupplierProductDto,
  ) {
    return this.suppliers.addProduct(id, dto);
  }

  @Patch("suppliers/:id/products/:productId")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  updateProduct(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateSupplierProductDto,
  ) {
    return this.suppliers.updateProduct(id, productId, dto);
  }

  @Get("suppliers/:id/delivery-records")
  @Exportable<SupplierDeliveryRecord>("delivery-records", [
    { header: "PO reference", value: (r) => r.poReference },
    { header: "Expected", value: (r) => r.expectedDate.toISOString().slice(0, 10) },
    { header: "Delivered", value: (r) => r.actualDeliveryDate.toISOString().slice(0, 10) },
    { header: "On time", value: (r) => (r.onTime ? "Yes" : "No") },
  ])
  listDeliveryRecords(@Param("id") id: string, @Query() query: ListQueryDto) {
    return this.suppliers.listDeliveryRecords(id, query);
  }

  @Post("suppliers/:id/delivery-records")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  addDeliveryRecord(
    @Param("id") id: string,
    @Body() dto: CreateSupplierDeliveryRecordDto,
  ) {
    return this.suppliers.addDeliveryRecord(id, dto);
  }
}
