import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TransferStatus } from "../generated/prisma";
import { CompletePickDto } from "./dto/complete-pick.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { TransfersService } from "./transfers.service";

@ApiTags("transfers")
@Controller()
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get("transfers")
  list(@Query("status") status?: TransferStatus) {
    return this.transfers.list(status);
  }

  @Post("transfers")
  create(@Body() dto: CreateTransferDto) {
    return this.transfers.create(dto);
  }

  @Get("transfers/:id")
  findOne(@Param("id") id: string) {
    return this.transfers.findOne(id);
  }

  @Post("pick-tasks/:id/complete")
  completePick(@Param("id") id: string, @Body() dto: CompletePickDto) {
    return this.transfers.completePick(id, dto);
  }
}
