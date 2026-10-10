import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Role, Roles } from "@mms/shared";
import { GoodsReceivedNoteStatus } from "../generated/prisma";
import { CreateGoodsReceivedNoteDto } from "./dto/create-goods-received-note.dto";
import { RecordScanDto } from "./dto/record-scan.dto";
import { GoodsReceivedNotesService } from "./goods-received-notes.service";

@ApiTags("goods-received-notes")
@Controller()
export class GoodsReceivedNotesController {
  constructor(private readonly goodsReceivedNotes: GoodsReceivedNotesService) {}

  @Get("goods-received-notes")
  list(@Query("status") status?: GoodsReceivedNoteStatus) {
    return this.goodsReceivedNotes.list(status);
  }

  @Post("goods-received-notes")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoodsReceivedNoteDto) {
    return this.goodsReceivedNotes.create({ ...dto, receivedById: user.id });
  }

  @Get("goods-received-notes/:id")
  findOne(@Param("id") id: string) {
    return this.goodsReceivedNotes.findOne(id);
  }

  @Post("goods-received-notes/:id/scans")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  recordScan(@Param("id") id: string, @Body() dto: RecordScanDto) {
    return this.goodsReceivedNotes.recordScan(id, dto);
  }

  @Post("goods-received-notes/:id/finalize")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  finalize(@Param("id") id: string) {
    return this.goodsReceivedNotes.finalize(id);
  }
}
