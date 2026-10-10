import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Exportable, Role, Roles } from "@mms/shared";
import { StockCount } from "../generated/prisma";
import {
  CountSuggestionsQuery,
  CreateStockCountDto,
  ListStockCountsQuery,
  RecordCountDto,
  SubmitStockCountDto,
} from "./dto/stock-count.dto";
import { StockCountsService, summarize } from "./stock-counts.service";

type CountRow = StockCount & ReturnType<typeof summarize>;

/** D-19. Managers start, post and cancel counts; warehouse staff count. */
@ApiTags("stock-counts")
@Controller("stock-counts")
export class StockCountsController {
  constructor(private readonly counts: StockCountsService) {}

  @Get()
  @Exportable<CountRow>("stock-counts", [
    { header: "Count", value: (c) => c.countNumber },
    { header: "Location", value: (c) => c.locationCode },
    { header: "Type", value: (c) => c.type },
    { header: "Status", value: (c) => c.status },
    { header: "Lines", value: (c) => c.lineCount },
    { header: "Counted", value: (c) => c.countedLines },
    { header: "Lines with variance", value: (c) => c.linesWithVariance },
    { header: "Units over", value: (c) => c.unitsOver },
    { header: "Units short", value: (c) => c.unitsShort },
    { header: "Variance value (KES)", value: (c) => c.varianceValue },
    { header: "Started by", value: (c) => c.createdById },
    { header: "Started", value: (c) => c.createdAt },
    { header: "Posted by", value: (c) => c.postedById },
    { header: "Posted", value: (c) => c.postedAt },
  ])
  list(@Query() query: ListStockCountsQuery) {
    return this.counts.list(query);
  }

  /** Must stay above ":id" so "suggestions" isn't read as an id. */
  @Get("suggestions")
  suggestions(@Query() query: CountSuggestionsQuery) {
    return this.counts.suggestions(query.locationCode, query.limit);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.counts.findOne(id, user);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockCountDto) {
    return this.counts.create(dto, user);
  }

  @Put(":id/lines/:sku")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  recordCount(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("sku") sku: string,
    @Body() dto: RecordCountDto,
  ) {
    return this.counts.recordCount(id, sku, dto.countedQty, user);
  }

  @Post(":id/submit")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  submit(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SubmitStockCountDto) {
    return this.counts.submit(id, dto.uncounted ?? "reject", user);
  }

  @Post(":id/post")
  @Roles(Role.OWNER, Role.MANAGER)
  post(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.counts.post(id, user);
  }

  @Post(":id/cancel")
  @Roles(Role.OWNER, Role.MANAGER)
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.counts.cancel(id, user);
  }
}
