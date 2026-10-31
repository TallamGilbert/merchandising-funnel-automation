import { Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Exportable, Role, Roles } from "@mms/shared";
import { InboxEvent, InboxStatus } from "../generated/prisma";
import { InboxProcessor } from "./inbox.processor";
import { InboxRepository } from "./inbox.repository";
import { ListInboxQuery } from "./list-inbox.query";

@ApiTags("inbox")
@Roles(Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)
@Controller("inbox")
export class InboxController {
  constructor(
    private readonly inboxRepository: InboxRepository,
    private readonly processor: InboxProcessor,
  ) {}

  @Get()
  @Exportable<InboxEvent>("posting-inbox", [
    { header: "Event", value: (e) => e.eventId },
    { header: "Type", value: (e) => e.routingKey },
    { header: "Status", value: (e) => e.status },
    { header: "Attempts", value: (e) => e.attempts },
    { header: "Last error", value: (e) => e.lastError },
    { header: "Received", value: (e) => e.receivedAt },
    { header: "Posted", value: (e) => e.postedAt },
  ])
  list(@Query() query: ListInboxQuery) {
    return this.inboxRepository.list(query);
  }

  /** After fixing the cause (e.g. creating the missing PO line), try posting again now. */
  @Post(":eventId/retry")
  @Roles(Role.OWNER, Role.ACCOUNTANT)
  async retry(@Param("eventId") eventId: string) {
    const event = await this.inboxRepository.findById(eventId);
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);
    if (event.status === InboxStatus.POSTED) return { eventId, result: "already-posted" };
    await this.inboxRepository.requeue(eventId);
    return { eventId, result: await this.processor.process(eventId) };
  }
}
