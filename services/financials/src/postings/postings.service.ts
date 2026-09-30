import { Injectable } from "@nestjs/common";
import {
  DayClosedEvent,
  DEFAULT_CURRENCY_CODE,
  GoodsReceivedEvent,
  ItemReturnedEvent,
  ItemSoldEvent,
  PaymentMethodType,
} from "@mms/shared";
import { ACCOUNTS } from "../accounts/chart-of-accounts";
import { EntrySource } from "../generated/prisma";
import { balanced, JournalLineDraft } from "../ledger/journal";
import { LedgerRepository } from "../ledger/ledger.repository";
import { round2, sumMoney } from "../ledger/money";
import { InventoryClientService } from "../lookups/inventory-client.service";
import { ProcurementClientService } from "../lookups/procurement-client.service";
import { PermanentPostingError } from "./posting-errors";
import { PostingPlan, SaleFactDraft } from "./posting-plan";

const PAYMENT_ACCOUNT: Record<PaymentMethodType, string> = {
  CASH: ACCOUNTS.CASH.code,
  CARD: ACCOUNTS.CARD_RECEIVABLE.code,
  // Paying with a gift card uses up money the business already holds for it.
  GIFT_CARD: ACCOUNTS.GIFT_CARDS.code,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function businessDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Translates each domain event into the accounting it implies (FR-8.1–8.3,
 * D-11–D-14). Pure bookkeeping: it reads what it needs from other modules
 * and returns a plan; LedgerRepository commits the plan atomically.
 */
@Injectable()
export class PostingsService {
  constructor(
    private readonly procurement: ProcurementClientService,
    private readonly inventory: InventoryClientService,
    private readonly ledger: LedgerRepository,
  ) {}

  /**
   * FR-8.1 — goods in: Dr Inventory, Cr Accounts payable at the PO's frozen
   * unit costs, and one supplier bill due after the PO's payment terms.
   * Damaged (quarantined) units are not booked — D-11.
   */
  async goodsReceived(event: GoodsReceivedEvent): Promise<PostingPlan> {
    const po = await this.procurement.getPurchaseOrder(event.poNumber);
    if (po.currency !== DEFAULT_CURRENCY_CODE) {
      throw new PermanentPostingError(
        `${event.poNumber} is priced in ${po.currency}; the ledger is kept in ${DEFAULT_CURRENCY_CODE} only (D-13) — book it manually`,
      );
    }

    const occurredAt = new Date(event.occurredAt);
    const lines: JournalLineDraft[] = [];
    const values: number[] = [];
    let damagedUnits = 0;

    for (const line of event.lines) {
      if (line.condition === "DAMAGED") {
        damagedUnits += line.quantityReceived;
        continue;
      }
      if (line.quantityReceived <= 0) continue;
      const poLine = po.lines.find((l) => l.sku === line.sku);
      if (!poLine) {
        throw new PermanentPostingError(`${line.sku} was received on ${event.goodsReceivedNoteNumber} but isn't on ${event.poNumber}`);
      }
      const value = round2(Number(poLine.unitCost) * line.quantityReceived);
      values.push(value);
      lines.push({
        accountCode: ACCOUNTS.INVENTORY.code,
        debit: value,
        memo: `${line.quantityReceived} × ${line.sku} @ ${Number(poLine.unitCost).toFixed(2)}`,
      });
    }

    const total = sumMoney(values);
    if (total === 0) return { entry: null };

    const damagedNote = damagedUnits ? ` (${damagedUnits} damaged unit${damagedUnits === 1 ? "" : "s"} quarantined, not booked)` : "";
    return {
      entry: balanced({
        occurredAt,
        source: EntrySource.GOODS_RECEIVED,
        sourceRef: event.goodsReceivedNoteNumber,
        description: `Goods received ${event.goodsReceivedNoteNumber} against ${event.poNumber} from ${po.supplierName}${damagedNote}`,
        lines: [...lines, { accountCode: ACCOUNTS.ACCOUNTS_PAYABLE.code, credit: total, memo: po.supplierName }],
      }),
      bill: {
        goodsReceivedNoteNumber: event.goodsReceivedNoteNumber,
        poNumber: event.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        amount: total,
        currency: po.currency,
        billDate: occurredAt,
        dueDate: new Date(occurredAt.getTime() + po.paymentTermsDays * DAY_MS),
      },
    };
  }

  /**
   * FR-8.2 — a sale: takings by payment method; revenue net of VAT, VAT as
   * a liability; and cost of goods sold out of inventory at Inventory's
   * current unit cost — D-12.
   */
  async itemSold(event: ItemSoldEvent): Promise<PostingPlan> {
    const occurredAt = new Date(event.occurredAt);
    const costs = await Promise.all(event.lines.map((l) => this.inventory.getUnitCost(l.sku)));

    const facts: SaleFactDraft[] = event.lines.map((line, i) => ({
      occurredAt,
      businessDate: businessDate(occurredAt),
      storeId: event.storeId,
      transactionId: event.transactionId,
      sku: line.sku,
      productName: line.productName,
      quantity: line.quantitySold,
      revenue: round2(line.lineTotal - line.taxAmount),
      taxAmount: round2(line.taxAmount),
      cogs: round2(costs[i] * line.quantitySold),
      unitCost: costs[i],
    }));

    const payments = new Map<string, number[]>();
    for (const p of event.paymentMethods) {
      const account = PAYMENT_ACCOUNT[p.method];
      payments.set(account, [...(payments.get(account) ?? []), p.amount]);
    }

    const revenue = sumMoney(facts.map((f) => f.revenue));
    const tax = sumMoney(facts.map((f) => f.taxAmount));
    const cogs = sumMoney(facts.map((f) => f.cogs));

    return {
      entry: balanced({
        occurredAt,
        source: EntrySource.ITEM_SOLD,
        sourceRef: event.transactionId,
        storeId: event.storeId,
        description: `Sale at ${event.storeId} ${event.registerId} — ${facts.length} line${facts.length === 1 ? "" : "s"}`,
        lines: [
          ...[...payments.entries()].map(([accountCode, amounts]) => ({ accountCode, debit: sumMoney(amounts) })),
          { accountCode: ACCOUNTS.SALES.code, credit: revenue },
          { accountCode: ACCOUNTS.VAT_PAYABLE.code, credit: tax },
          { accountCode: ACCOUNTS.COGS.code, debit: cogs },
          { accountCode: ACCOUNTS.INVENTORY.code, credit: cogs },
        ],
      }),
      facts,
    };
  }

  /**
   * Refunds reverse a sale's revenue, VAT and cost at the original sale's
   * split and unit cost, and the refund leaves the till in cash — D-14.
   */
  async itemReturned(event: ItemReturnedEvent): Promise<PostingPlan> {
    const occurredAt = new Date(event.occurredAt);
    const original = await this.ledger.findSaleFacts(event.originalTransactionId);

    const facts: SaleFactDraft[] = [];
    for (const line of event.lines) {
      const sold = original.find((f) => f.sku === line.sku);
      // A sale made before Financials was running has no facts to reverse:
      // cost it at Inventory's current unit cost and book the whole refund
      // against revenue, since its VAT split is unknown.
      const unitCost = sold ? Number(sold.unitCost) : await this.inventory.getUnitCost(line.sku);
      const gross = sold ? Number(sold.revenue) + Number(sold.taxAmount) : 0;
      const taxShare = sold && gross > 0 ? Number(sold.taxAmount) / gross : 0;
      const taxAmount = round2(line.refundAmount * taxShare);
      facts.push({
        occurredAt,
        businessDate: businessDate(occurredAt),
        storeId: event.storeId,
        transactionId: event.originalTransactionId,
        returnId: event.returnId,
        sku: line.sku,
        productName: line.productName,
        quantity: -line.quantityReturned,
        revenue: -round2(line.refundAmount - taxAmount),
        taxAmount: -taxAmount,
        cogs: -round2(unitCost * line.quantityReturned),
        unitCost,
      });
    }

    const refund = sumMoney(event.lines.map((l) => l.refundAmount));
    const revenue = -sumMoney(facts.map((f) => f.revenue));
    const tax = -sumMoney(facts.map((f) => f.taxAmount));
    const cogs = -sumMoney(facts.map((f) => f.cogs));

    return {
      entry: balanced({
        occurredAt,
        source: EntrySource.ITEM_RETURNED,
        sourceRef: event.returnId,
        storeId: event.storeId,
        description: `Refund at ${event.storeId} ${event.registerId} for sale ${event.originalTransactionId}`,
        lines: [
          { accountCode: ACCOUNTS.SALES_RETURNS.code, debit: revenue },
          { accountCode: ACCOUNTS.VAT_PAYABLE.code, debit: tax },
          { accountCode: ACCOUNTS.CASH.code, credit: refund },
          { accountCode: ACCOUNTS.INVENTORY.code, debit: cogs },
          { accountCode: ACCOUNTS.COGS.code, credit: cogs },
        ],
      }),
      facts,
    };
  }

  /** FR-8.3 — a till's shortage is an expense; an overage reduces it. Balanced days book nothing. */
  dayClosed(event: DayClosedEvent): PostingPlan {
    const amount = round2(event.discrepancyAmount);
    if (amount === 0) return { entry: null };

    const shortage = amount < 0;
    const abs = Math.abs(amount);
    const why = event.discrepancyExplanation ? ` — ${event.discrepancyExplanation}` : "";
    return {
      entry: balanced({
        occurredAt: new Date(event.occurredAt),
        source: EntrySource.DAY_CLOSED,
        sourceRef: `${event.storeId}/${event.businessDate}`,
        storeId: event.storeId,
        description: `Cash ${shortage ? "short" : "over"} at ${event.storeId} on ${event.businessDate}${why}`,
        lines: shortage
          ? [
              { accountCode: ACCOUNTS.CASH_OVER_SHORT.code, debit: abs },
              { accountCode: ACCOUNTS.CASH.code, credit: abs },
            ]
          : [
              { accountCode: ACCOUNTS.CASH.code, debit: abs },
              { accountCode: ACCOUNTS.CASH_OVER_SHORT.code, credit: abs },
            ],
      }),
    };
  }
}
