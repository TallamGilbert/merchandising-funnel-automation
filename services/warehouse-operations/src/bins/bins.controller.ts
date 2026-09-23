import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BinsService } from "./bins.service";
import { CreateBinDto } from "./dto/create-bin.dto";

@ApiTags("bins")
@Controller()
export class BinsController {
  constructor(private readonly bins: BinsService) {}

  @Get("bins")
  list(@Query("locationCode") locationCode?: string) {
    return this.bins.list(locationCode);
  }

  @Post("bins")
  create(@Body() dto: CreateBinDto) {
    return this.bins.create(dto);
  }

  // Declared before `bins/:code` so "utilization" is not read as a bin code.
  @Get("bins/utilization")
  utilization(@Query("locationCode") locationCode?: string) {
    return this.bins.utilization(locationCode);
  }

  @Get("bins/:code")
  findOne(@Param("code") code: string) {
    return this.bins.findByCode(code);
  }
}
