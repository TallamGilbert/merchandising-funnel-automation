import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PutawayTaskStatus } from "../generated/prisma";
import { AssignBinDto } from "./dto/assign-bin.dto";
import { CompletePutawayDto } from "./dto/complete-putaway.dto";
import { PutawayService } from "./putaway.service";

@ApiTags("putaway-tasks")
@Controller()
export class PutawayController {
  constructor(private readonly putaway: PutawayService) {}

  @Get("putaway-tasks")
  list(
    @Query("status") status?: PutawayTaskStatus,
    @Query("locationCode") locationCode?: string,
  ) {
    return this.putaway.list(status, locationCode);
  }

  @Get("putaway-tasks/:id")
  findOne(@Param("id") id: string) {
    return this.putaway.findOne(id);
  }

  @Post("putaway-tasks/:id/assign")
  assign(@Param("id") id: string, @Body() dto: AssignBinDto) {
    return this.putaway.assign(id, dto);
  }

  @Post("putaway-tasks/:id/complete")
  complete(@Param("id") id: string, @Body() dto: CompletePutawayDto) {
    return this.putaway.complete(id, dto);
  }
}
