import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { GrnStatus } from "../generated/prisma";
import { CreateGrnDto } from "./dto/create-grn.dto";
import { RecordScanDto } from "./dto/record-scan.dto";
import { GrnsService } from "./grns.service";

@ApiTags("grns")
@Controller()
export class GrnsController {
  constructor(private readonly grns: GrnsService) {}

  @Get("grns")
  list(@Query("status") status?: GrnStatus) {
    return this.grns.list(status);
  }

  @Post("grns")
  create(@Body() dto: CreateGrnDto) {
    return this.grns.create(dto);
  }

  @Get("grns/:id")
  findOne(@Param("id") id: string) {
    return this.grns.findOne(id);
  }

  @Post("grns/:id/scans")
  recordScan(@Param("id") id: string, @Body() dto: RecordScanDto) {
    return this.grns.recordScan(id, dto);
  }

  @Post("grns/:id/finalize")
  finalize(@Param("id") id: string) {
    return this.grns.finalize(id);
  }
}
