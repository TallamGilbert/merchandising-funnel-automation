import { DayClosedEvent, GoodsReceivedEvent, ItemReturnedEvent, ItemSoldEvent } from "@mms/shared";
import { EntrySource } from "../../generated/prisma";
import { JournalDraft } from "../../ledger/journal";
import { LedgerRepository } from "../../ledger/ledger.repository";
import { InventoryClientService } from "../../lookups/inventory-client.service";
import { ProcurementClientService } from "../../lookups/procurement-client.service";
import { PermanentPostingError, TransientPostingError } from "../posting-errors";
import { PostingsService } from "../postings.service";

/** Net amount per account: debits positive, credits negative. */
function net(entry: JournalDraft | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of entry?.lines ?? []) {
    out[l.accountCode] = Math.round(((out[l.accountCode] ?? 0) + (l.debit ?? 0) - (l.credit ?? 0)) * 100) / 100;
  }
  return out;
}

describe("PostingsService", () => {
  let service: PostingsService;
  let procurement: { getPurchaseOrder: jest.Mock };
  let inventory: { getUnitCost: jest.Mock };
  let ledger: { findSaleFacts: jest.Mock };

  const po = {
    poNumber: "PO-1001",
    supplierId: "sup-1",
    supplierName: "Acme Furniture",
    paymentTermsDays: 30,
    currency: "KES",
    lines: [
      { sku: "CHAIR", productName: "Oak Chair", unitCost: "10.00" },
      { sku: "LAMP", productName: "Lamp", unitCost: "4.50" },
    ],
  };

  beforeEach(() => {
    procurement = { getPurchaseOrder: jest.fn().mockResolvedValue(po) };
    inventory = { getUnitCost: jest.fn().mockResolvedValue(10) };
    ledger = { findSaleFacts: jest.fn().mockResolvedValue([]) };
    service = new PostingsService(
      procurement as unknown as ProcurementClientService,
      inventory as unknown as InventoryClientService,
      ledger as unknown as LedgerRepository,
    );
  });

  describe("goodsReceived (FR-8.1)", () => {
    const event: GoodsReceivedEvent = {
      eventId: "e1",
      occurredAt: "2026-09-25T09:00:00.000Z",
      goodsReceivedNoteNumber: "GRN-500",
      poNumber: "PO-1001",
      supplierId: "sup-1",
      receivedAtLocation: "WH-MAIN",
      lines: [
        { sku: "CHAIR", productName: "Oak Chair", quantityOrdered: 100, quantityReceived: 95, condition: "GOOD", discrepancyType: "SHORTAGE" },
        { sku: "LAMP", productName: "Lamp", quantityOrdered: 10, quantityReceived: 10, condition: "GOOD", discrepancyType: "NONE" },
        { sku: "CHAIR", productName: "Oak Chair", quantityOrdered: 0, quantityReceived: 3, condition: "DAMAGED", discrepancyType: "DAMAGE" },
      ],
    };

    it("books received goods into inventory and owes the supplier at the PO's frozen cost (brief scenario 2)", async () => {
      const plan = await service.goodsReceived(event);

      // 95 × 10.00 + 10 × 4.50 = 995.00
      expect(net(plan.entry)).toEqual({ "1200": 995, "2000": -995 });
      expect(plan.entry?.source).toBe(EntrySource.GOODS_RECEIVED);
      expect(plan.entry?.sourceRef).toBe("GRN-500");
      expect(procurement.getPurchaseOrder).toHaveBeenCalledWith("PO-1001");
    });

    it("leaves damaged, quarantined units out of the books (D-11)", async () => {
      const plan = await service.goodsReceived(event);
      expect(plan.entry?.description).toContain("3 damaged units quarantined, not booked");
    });

    it("raises a supplier bill due after the PO's payment terms", async () => {
      const { bill } = await service.goodsReceived(event);

      expect(bill).toEqual(
        expect.objectContaining({
          goodsReceivedNoteNumber: "GRN-500",
          supplierName: "Acme Furniture",
          amount: 995,
          currency: "KES",
          billDate: new Date("2026-09-25T09:00:00.000Z"),
          dueDate: new Date("2026-10-25T09:00:00.000Z"),
        }),
      );
    });

    it("books nothing when every unit arrived damaged", async () => {
      const plan = await service.goodsReceived({ ...event, lines: [event.lines[2]] });
      expect(plan).toEqual({ entry: null });
    });

    it("refuses a PO priced in another currency (D-13)", async () => {
      procurement.getPurchaseOrder.mockResolvedValue({ ...po, currency: "USD" });
      await expect(service.goodsReceived(event)).rejects.toThrow(PermanentPostingError);
    });

    it("refuses a received SKU that isn't on the PO", async () => {
      const stray = { ...event.lines[1], sku: "SOFA" };
      await expect(service.goodsReceived({ ...event, lines: [stray] })).rejects.toThrow("isn't on PO-1001");
    });

    it("lets Procurement being down surface as retryable", async () => {
      procurement.getPurchaseOrder.mockRejectedValue(new TransientPostingError("down"));
      await expect(service.goodsReceived(event)).rejects.toThrow(TransientPostingError);
    });
  });

  describe("itemSold (FR-8.2)", () => {
    const event: ItemSoldEvent = {
      eventId: "e2",
      occurredAt: "2026-09-25T13:19:00.000Z",
      transactionId: "txn-777",
      storeId: "STORE-3",
      registerId: "REG-2",
      cashierId: "cashier-amy",
      lines: [
        { sku: "CHAIR", productName: "Oak Chair", quantitySold: 1, unitPrice: 20, discountAmount: 0, taxAmount: 0, lineTotal: 20, reservationId: "r1" },
      ],
      paymentMethods: [{ method: "CASH", amount: 20 }],
      totalAmount: 20,
    };

    it("records revenue, cost of goods sold and the inventory it came out of (brief scenario 4)", async () => {
      const plan = await service.itemSold(event);

      // Revenue 20, COGS 10 (Inventory's unit cost) → gross profit 10.
      expect(net(plan.entry)).toEqual({ "1000": 20, "4000": -20, "5000": 10, "1200": -10 });
      expect(plan.entry?.storeId).toBe("STORE-3");
      expect(inventory.getUnitCost).toHaveBeenCalledWith("CHAIR");
    });

    it("keeps VAT out of revenue and splits takings by payment method", async () => {
      const plan = await service.itemSold({
        ...event,
        lines: [
          { ...event.lines[0], quantitySold: 2, unitPrice: 100, discountAmount: 20, taxAmount: 28.8, lineTotal: 208.8 },
        ],
        paymentMethods: [
          { method: "CARD", amount: 150 },
          { method: "CASH", amount: 50 },
          { method: "GIFT_CARD", amount: 8.8 },
        ],
        totalAmount: 208.8,
      });

      expect(net(plan.entry)).toEqual({
        "1100": 150,
        "1000": 50,
        "2200": 8.8,
        "4000": -180,
        "2100": -28.8,
        "5000": 20,
        "1200": -20,
      });
    });

    it("keeps one profitability fact per line, net of VAT", async () => {
      const { facts } = await service.itemSold(event);
      expect(facts).toEqual([
        expect.objectContaining({
          businessDate: "2026-09-25",
          storeId: "STORE-3",
          transactionId: "txn-777",
          sku: "CHAIR",
          quantity: 1,
          revenue: 20,
          taxAmount: 0,
          cogs: 10,
          unitCost: 10,
        }),
      ]);
    });

    it("refuses a sale whose payments don't cover the total", async () => {
      await expect(
        service.itemSold({ ...event, paymentMethods: [{ method: "CASH", amount: 19 }] }),
      ).rejects.toThrow("debits");
    });
  });

  describe("itemReturned (D-14)", () => {
    const event: ItemReturnedEvent = {
      eventId: "e3",
      occurredAt: "2026-09-26T10:00:00.000Z",
      returnId: "ret-1",
      originalTransactionId: "txn-777",
      storeId: "STORE-3",
      registerId: "REG-2",
      lines: [{ sku: "CHAIR", productName: "Oak Chair", quantityReturned: 1, locationCode: "STORE-3", refundAmount: 104.4 }],
    };

    it("reverses revenue, VAT and cost at the original sale's split and unit cost", async () => {
      ledger.findSaleFacts.mockResolvedValue([
        { sku: "CHAIR", revenue: "180.00", taxAmount: "28.80", unitCost: "12.00" },
      ]);

      const plan = await service.itemReturned(event);

      // 104.40 refund at the sale's 28.8/208.8 VAT share → 14.40 VAT, 90.00 revenue.
      expect(net(plan.entry)).toEqual({ "4900": 90, "2100": 14.4, "1000": -104.4, "1200": 12, "5000": -12 });
      expect(inventory.getUnitCost).not.toHaveBeenCalled();
      expect(plan.facts?.[0]).toEqual(
        expect.objectContaining({ returnId: "ret-1", quantity: -1, revenue: -90, taxAmount: -14.4, cogs: -12 }),
      );
    });

    it("falls back to Inventory's cost when the original sale predates Financials", async () => {
      const plan = await service.itemReturned(event);

      expect(inventory.getUnitCost).toHaveBeenCalledWith("CHAIR");
      expect(net(plan.entry)).toEqual({ "4900": 104.4, "1000": -104.4, "1200": 10, "5000": -10 });
    });
  });

  describe("dayClosed (FR-8.3)", () => {
    const event: DayClosedEvent = {
      eventId: "e4",
      occurredAt: "2026-09-25T20:00:00.000Z",
      storeId: "STORE-3",
      businessDate: "2026-09-25",
      expectedTotal: 5000,
      actualCountedTotal: 4950,
      discrepancyAmount: -50,
      discrepancyExplanation: "Payout for cleaning supplies",
      closedByManagerId: "mgr-james",
    };

    it("books a shortage as a cash over/short expense (brief scenario 5)", () => {
      const plan = service.dayClosed(event);

      expect(net(plan.entry)).toEqual({ "6100": 50, "1000": -50 });
      expect(plan.entry?.sourceRef).toBe("STORE-3/2026-09-25");
      expect(plan.entry?.description).toContain("Payout for cleaning supplies");
    });

    it("books an overage against the same account", () => {
      const plan = service.dayClosed({ ...event, actualCountedTotal: 5020, discrepancyAmount: 20 });
      expect(net(plan.entry)).toEqual({ "1000": 20, "6100": -20 });
    });

    it("books nothing for a balanced day", () => {
      expect(service.dayClosed({ ...event, discrepancyAmount: 0 })).toEqual({ entry: null });
    });
  });
});
