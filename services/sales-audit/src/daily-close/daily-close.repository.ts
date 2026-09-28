import { Injectable } from "@nestjs/common";
import { DailyCloseStatus, Prisma } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

export interface CountToSave {
  storeDayLedgerId: string;
  storeId: string;
  businessDate: string;
  expectedTotal: number;
  actualCountedTotal: number;
  discrepancyAmount: number;
  status: DailyCloseStatus;
}

export interface DiscrepancyLogToWrite {
  storeId: string;
  businessDate: string;
  discrepancyAmount: number;
  explanation: string | null;
}

@Injectable()
export class DailyCloseRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByStoreDay(storeId: string, businessDate: string) {
    return this.prisma.dailyClose.findFirst({ where: { storeId, businessDate } });
  }

  /** A fresh count replaces the previous one and clears its explanation. */
  saveCount(count: CountToSave) {
    return this.prisma.dailyClose.upsert({
      where: { storeDayLedgerId: count.storeDayLedgerId },
      create: count,
      update: {
        expectedTotal: count.expectedTotal,
        actualCountedTotal: count.actualCountedTotal,
        discrepancyAmount: count.discrepancyAmount,
        status: count.status,
        discrepancyExplanation: null,
      },
    });
  }

  update(id: string, data: Prisma.DailyCloseUpdateArgs["data"]) {
    return this.prisma.dailyClose.update({ where: { id }, data });
  }

  /** Writes the historical log entry and closes the day in one database transaction. */
  async closeWithLogEntry(id: string, closedByManagerId: string, logEntry: DiscrepancyLogToWrite) {
    await this.prisma.$transaction([
      this.prisma.discrepancyLogEntry.create({ data: logEntry }),
      this.prisma.dailyClose.update({
        where: { id },
        data: {
          status: DailyCloseStatus.CLOSED,
          closedByManagerId,
          closedAt: new Date(),
        },
      }),
    ]);
  }
}
