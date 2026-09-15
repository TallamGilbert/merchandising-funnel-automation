import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReorderSuggestionStatus } from "../generated/prisma";
import { ReorderSuggestionsService } from "./reorder-suggestions.service";

@ApiTags("reorder-suggestions")
@Controller("reorder-suggestions")
export class ReorderSuggestionsController {
  constructor(private readonly reorderSuggestions: ReorderSuggestionsService) {}

  @Get()
  list(@Query("status") status?: ReorderSuggestionStatus) {
    return this.reorderSuggestions.list(status);
  }

  @Post(":id/dismiss")
  dismiss(@Param("id") id: string) {
    return this.reorderSuggestions.dismiss(id);
  }
}
