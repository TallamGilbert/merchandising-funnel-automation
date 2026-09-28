import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventBusService, EventRoutingKey, ItemReturnedEvent } from "@mms/shared";
import { TransactionStatus } from "../generated/prisma";
import { TransactionsRepository } from "../transactions/transactions.repository";
import { CreateReturnDto } from "./dto/create-return.dto";
import { ReturnsRepository } from "./returns.repository";

@Injectable()
export class ReturnsService {
  constructor(
    private readonly returns: ReturnsRepository,
    private readonly transactions: TransactionsRepository,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * FR-6.4 — reverses part or all of an earlier sale. No inspection step
   * (D-5): whatever is returned goes straight back to Available via the
   * ItemReturned event (D-8). A line can be returned at most once up to its
   * originally sold quantity, tracked by TransactionLine.quantityReturned.
   */
  async processReturn(dto: CreateReturnDto) {
    const transaction = await this.transactions.findByIdWithLines(dto.originalTransactionId);
    if (!transaction) {
      throw new NotFoundException(`Transaction ${dto.originalTransactionId} not found`);
    }

    const returnLines = dto.lines.map((requested) => {
      const line = transaction.lines.find((l) => l.id === requested.transactionLineId);
      if (!line) {
        throw new BadRequestException(
          `Line ${requested.transactionLineId} is not on transaction ${transaction.id}`,
        );
      }
      const remaining = line.quantitySold - line.quantityReturned;
      if (requested.quantityReturned > remaining) {
        throw new BadRequestException(
          `Only ${remaining} unit(s) of ${line.sku} remain returnable on this transaction`,
        );
      }
      const refundAmount = round2(
        (Number(line.lineTotal) / line.quantitySold) * requested.quantityReturned,
      );
      return { line, requested, refundAmount };
    });

    const totalRefund = round2(returnLines.reduce((sum, rl) => sum + rl.refundAmount, 0));

    const sequence = await this.returns.nextSequence();

    const returnTransaction = await this.returns.createWithLineIncrements(
      {
        id: randomUUID(),
        sequence,
        returnNumber: `RET-${1000 + sequence}`,
        originalTransactionId: transaction.id,
        storeId: dto.storeId,
        registerId: dto.registerId,
        refundAmount: totalRefund,
        lines: {
          create: returnLines.map(({ line, requested, refundAmount }) => ({
            transactionLineId: line.id,
            sku: line.sku,
            productName: line.productName,
            quantityReturned: requested.quantityReturned,
            locationCode: line.locationCode,
            refundAmount,
          })),
        },
      },
      returnLines.map(({ line, requested }) => ({
        transactionLineId: line.id,
        quantityReturned: requested.quantityReturned,
      })),
    );

    const refreshedLines = await this.transactions.findLines(transaction.id);
    const fullyReturned = refreshedLines.every((l) => l.quantityReturned >= l.quantitySold);
    if (fullyReturned) {
      await this.transactions.updateStatus(transaction.id, TransactionStatus.RETURNED);
    }

    const event: ItemReturnedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      returnId: returnTransaction.id,
      originalTransactionId: transaction.id,
      storeId: dto.storeId,
      registerId: dto.registerId,
      lines: returnLines.map(({ line, requested, refundAmount }) => ({
        sku: line.sku,
        productName: line.productName,
        quantityReturned: requested.quantityReturned,
        locationCode: line.locationCode,
        refundAmount,
      })),
    };
    await this.eventBus.publish(EventRoutingKey.ITEM_RETURNED, event);

    return returnTransaction;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
