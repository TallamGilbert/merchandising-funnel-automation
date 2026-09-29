import { Injectable } from "@nestjs/common";
import { InboxStatus, Prisma } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Stores an event once; a redelivery of the same eventId is a no-op. */
  async store(eventId: string, routingKey: string, payload: unknown): Promise<void> {
    await this.prisma.inboxEvent.createMany({
      data: [{ eventId, routingKey, payload: payload as Prisma.InputJsonValue }],
      skipDuplicates: true,
    });
  }

  findById(eventId: string) {
    return this.prisma.inboxEvent.findUnique({ where: { eventId } });
  }

  findDue(now: Date, take: number) {
    return this.prisma.inboxEvent.findMany({
      where: { status: InboxStatus.PENDING, nextAttempt: { lte: now } },
      orderBy: { receivedAt: "asc" },
      take,
    });
  }

  scheduleRetry(eventId: string, attempts: number, error: string, nextAttempt: Date) {
    return this.prisma.inboxEvent.update({
      where: { eventId },
      data: { attempts, lastError: error, nextAttempt },
    });
  }

  markNeedsAttention(eventId: string, attempts: number, error: string) {
    return this.prisma.inboxEvent.update({
      where: { eventId },
      data: { status: InboxStatus.NEEDS_ATTENTION, attempts, lastError: error },
    });
  }

  /** Puts a flagged event back in the queue, e.g. after the PO was fixed. */
  requeue(eventId: string) {
    return this.prisma.inboxEvent.update({
      where: { eventId },
      data: { status: InboxStatus.PENDING, nextAttempt: new Date() },
    });
  }

  list(status?: InboxStatus) {
    return this.prisma.inboxEvent.findMany({
      where: { status },
      orderBy: { receivedAt: "desc" },
      take: 200,
    });
  }

  countByStatus() {
    return this.prisma.inboxEvent.groupBy({ by: ["status"], _count: { _all: true } });
  }
}
