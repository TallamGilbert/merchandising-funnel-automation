import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role, Roles } from "@mms/shared";
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
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  dismiss(@Param("id") id: string) {
    return this.reorderSuggestions.dismiss(id);
  }
}
