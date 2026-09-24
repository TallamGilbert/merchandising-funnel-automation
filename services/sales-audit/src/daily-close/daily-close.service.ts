import { randomUUID } from "crypto";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DayClosedEvent, EventBusService, EventRoutingKey } from "@mms/shared";
import { DailyCloseStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../item-sold-ledger/ledger.service";
import { RetailSalesClientService } from "../retail-sales-client/retail-sales-client.service";

const MISMATCH_EPSILON = 0.01;

@Injectable()
export class DailyCloseService {
  private readonly logger = new Logger(DailyCloseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly retailSales: RetailSalesClientService,
    private readonly eventBus: EventBusService,
  ) {}

  get(storeId: string, businessDate: string) {
    return this.prisma.dailyClose.findFirst({ where: { storeId, businessDate } });
  }

  /**
   * FR-7.1/7.2 — records the manager's physical count. The locally
   * accumulated expected total (kept current by consuming ItemSold, FR-7.7)
   * is cross-checked against Retail Sales' own record; per D-9, the REST
   * answer wins as the number of record for this close, and a mismatch is
   * only logged, never surfaced to the manager (a dropped/late ItemSold
   * event should never block or mislead a close).
   */
  async recordCount(storeId: string, businessDate: string, actualCountedTotal: number) {
    const ledger = await this.ledger.ensureLedger(storeId, businessDate);
    const localExpected = Number(ledger.expectedTotal);

    let expectedTotal = localExpected;
    try {
      const crossCheck = await this.retailSales.getExpectedTotal(storeId, businessDate);
      expectedTotal = crossCheck.expectedTotal;
      if (Math.abs(crossCheck.expectedTotal - localExpected) > MISMATCH_EPSILON) {
        this.logger.warn(
          `Expected total mismatch for ${storeId} on ${businessDate}: local ledger ${localExpected}, ` +
            `Retail Sales ${crossCheck.expectedTotal} — using Retail Sales' answer (D-9)`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not cross-check expected total with Retail Sales, using local ledger: ${(error as Error).message}`,
      );
    }

    const discrepancyAmount = round2(actualCountedTotal - expectedTotal);
    const status =
      discrepancyAmount !== 0 ? DailyCloseStatus.BLOCKED_ON_EXPLANATION : DailyCloseStatus.OPEN;

    return this.prisma.dailyClose.upsert({
      where: { storeDayLedgerId: ledger.id },
      create: {
        storeDayLedgerId: ledger.id,
        storeId,
        businessDate,
        expectedTotal,
        actualCountedTotal,
        discrepancyAmount,
        status,
      },
      update: {
        expectedTotal,
        actualCountedTotal,
        discrepancyAmount,
        status,
        discrepancyExplanation: null,
      },
    });
  }

  /** FR-7.4 — a fresh count invalidates any earlier explanation. */
  async explainDiscrepancy(storeId: string, businessDate: string, explanation: string) {
    const close = await this.get(storeId, businessDate);
    if (!close) {
      throw new NotFoundException(`No count recorded yet for ${storeId} on ${businessDate}`);
    }

    return this.prisma.dailyClose.update({
      where: { id: close.id },
      data: {
        discrepancyExplanation: explanation,
        status:
          close.status === DailyCloseStatus.BLOCKED_ON_EXPLANATION
            ? DailyCloseStatus.OPEN
            : close.status,
      },
    });
  }

  /**
   * FR-7.4/7.5/7.6 — blocks until any discrepancy is explained, writes the
   * historical log (even when the discrepancy is zero, so the log stays
   * complete), and publishes DayClosed.
   */
  async close(storeId: string, businessDate: string, closedByManagerId: string) {
    const close = await this.get(storeId, businessDate);
    if (!close || close.actualCountedTotal === null) {
      throw new BadRequestException(
        `No physical count has been recorded yet for ${storeId} on ${businessDate}`,
      );
    }
    if (close.status === DailyCloseStatus.CLOSED) {
      throw new BadRequestException(`${storeId} is already closed for ${businessDate}`);
    }
    if (close.status === DailyCloseStatus.BLOCKED_ON_EXPLANATION) {
      throw new BadRequestException(
        "This store's discrepancy must be explained before it can be closed",
      );
    }

    const discrepancyAmount = Number(close.discrepancyAmount ?? 0);
    const actualCountedTotal = Number(close.actualCountedTotal);

    await this.prisma.$transaction([
      this.prisma.discrepancyLogEntry.create({
        data: {
          storeId,
          businessDate,
          discrepancyAmount,
          explanation: close.discrepancyExplanation,
        },
      }),
      this.prisma.dailyClose.update({
        where: { id: close.id },
        data: {
          status: DailyCloseStatus.CLOSED,
          closedByManagerId,
          closedAt: new Date(),
        },
      }),
    ]);

    const event: DayClosedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      storeId,
      businessDate,
      expectedTotal: Number(close.expectedTotal),
      actualCountedTotal,
      discrepancyAmount,
      discrepancyExplanation: close.discrepancyExplanation,
      closedByManagerId,
    };
    await this.eventBus.publish(EventRoutingKey.DAY_CLOSED, event);

    return this.get(storeId, businessDate);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
