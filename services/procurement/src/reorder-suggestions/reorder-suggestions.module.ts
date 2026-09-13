import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { ReorderSuggestionsController } from "./reorder-suggestions.controller";
import { ReorderSuggestionsService } from "./reorder-suggestions.service";
import { StockLowConsumer } from "./stock-low.consumer";

@Module({
  imports: [EventBusModule],
  controllers: [ReorderSuggestionsController],
  providers: [ReorderSuggestionsService, StockLowConsumer],
})
export class ReorderSuggestionsModule {}
