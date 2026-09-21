import { Injectable, NotFoundException } from "@nestjs/common";
import { StockLowEvent } from "@mms/shared";
import { ReorderSuggestionStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReorderSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: ReorderSuggestionStatus) {
    return this.prisma.reorderSuggestion.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async dismiss(id: string) {
    await this.ensureExists(id);
    return this.prisma.reorderSuggestion.update({
      where: { id },
      data: { status: ReorderSuggestionStatus.DISMISSED },
    });
  }

  /** FR-2.7 — turns a consumed StockLow event into an advisory suggestion. No auto-ordering. */
  async createFromStockLowEvent(event: StockLowEvent) {
    return this.prisma.reorderSuggestion.create({
      data: {
        sku: event.sku,
        reason:
          `Available (${event.availableQuantity}) at ${event.locationCode} crossed the ` +
          `dynamic reorder threshold (${event.dynamicReorderThreshold}); recent velocity ` +
          `${event.salesVelocityUnitsPerDay} units/day.`,
        sourceEventId: event.eventId,
        status: ReorderSuggestionStatus.NEW,
      },
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.reorderSuggestion.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Reorder suggestion ${id} not found`);
    }
  }
}
