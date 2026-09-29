import { Controller, Get, NotFoundException, Param, ParseEnumPipe, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { InboxStatus } from "../generated/prisma";
import { InboxProcessor } from "./inbox.processor";
import { InboxRepository } from "./inbox.repository";

@ApiTags("inbox")
@Controller("inbox")
export class InboxController {
  constructor(
    private readonly inbox: InboxRepository,
    private readonly processor: InboxProcessor,
  ) {}

  @Get()
  @ApiQuery({ name: "status", enum: InboxStatus, required: false })
  list(@Query("status", new ParseEnumPipe(InboxStatus, { optional: true })) status?: InboxStatus) {
    return this.inbox.list(status);
  }

  /** After fixing the cause (e.g. creating the missing PO line), try posting again now. */
  @Post(":eventId/retry")
  async retry(@Param("eventId") eventId: string) {
    const event = await this.inbox.findById(eventId);
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);
    if (event.status === InboxStatus.POSTED) return { eventId, result: "already-posted" };
    await this.inbox.requeue(eventId);
    return { eventId, result: await this.processor.process(eventId) };
  }
}
