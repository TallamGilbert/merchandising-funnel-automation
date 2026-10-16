import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Exportable, Role, Roles } from "@mms/shared";
import { ReorderSuggestion } from "../generated/prisma";
import { ListReorderSuggestionsQuery } from "./list-reorder-suggestions.query";
import { ReorderSuggestionsService } from "./reorder-suggestions.service";

@ApiTags("reorder-suggestions")
@Controller("reorder-suggestions")
export class ReorderSuggestionsController {
  constructor(private readonly reorderSuggestions: ReorderSuggestionsService) {}

  @Get()
  @Exportable<ReorderSuggestion>("reorder-suggestions", [
    { header: "SKU", value: (s) => s.sku },
    { header: "Reason", value: (s) => s.reason },
    { header: "Status", value: (s) => s.status },
    { header: "Raised", value: (s) => s.createdAt },
  ])
  list(@Query() query: ListReorderSuggestionsQuery) {
    return this.reorderSuggestions.list(query);
  }

  @Post(":id/dismiss")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  dismiss(@Param("id") id: string) {
    return this.reorderSuggestions.dismiss(id);
  }
}
