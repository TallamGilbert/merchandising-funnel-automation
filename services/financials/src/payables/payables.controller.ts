import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { BillStatus } from "../generated/prisma";
import { PayBillDto } from "./dto/pay-bill.dto";
import { PayablesService } from "./payables.service";

@ApiTags("payables")
@Controller("payables")
export class PayablesController {
  constructor(private readonly payables: PayablesService) {}

  @Get()
  @ApiQuery({ name: "status", enum: BillStatus, required: false })
  @ApiQuery({ name: "supplierId", required: false })
  list(
    @Query("status", new ParseEnumPipe(BillStatus, { optional: true })) status?: BillStatus,
    @Query("supplierId") supplierId?: string,
  ) {
    return this.payables.list({ status, supplierId });
  }

  @Get("aging")
  @ApiQuery({ name: "asOf", required: false, description: "YYYY-MM-DD; default today" })
  aging(@Query("asOf") asOf?: string) {
    return this.payables.aging(asOf);
  }

  @Post(":id/pay")
  pay(@Param("id") id: string, @Body() dto: PayBillDto) {
    return this.payables.pay(id, dto.paymentReference, dto.paidOn);
  }
}
