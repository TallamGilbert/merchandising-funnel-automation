import { EventRoutingKey } from "@mms/shared";
import { LedgerRepository } from "../../ledger/ledger.repository";
import { PermanentPostingError, TransientPostingError } from "../../postings/posting-errors";
import { PostingsService } from "../../postings/postings.service";
import { backoffMs, InboxProcessor } from "../inbox.processor";
import { InboxRepository } from "../inbox.repository";

describe("InboxProcessor", () => {
  let processor: InboxProcessor;
  let inbox: Record<"findById" | "findDue" | "scheduleRetry" | "markNeedsAttention", jest.Mock>;
  let postings: Record<"goodsReceived" | "itemSold" | "itemReturned" | "dayClosed", jest.Mock>;
  let ledger: { commit: jest.Mock };

  const stored = (routingKey: string, attempts = 0) => ({
    eventId: "e1",
    routingKey,
    payload: { eventId: "e1" },
    status: "PENDING",
    attempts,
  });

  beforeEach(() => {
    inbox = {
      findById: jest.fn().mockResolvedValue(stored(EventRoutingKey.ITEM_SOLD)),
      findDue: jest.fn().mockResolvedValue([]),
      scheduleRetry: jest.fn(),
      markNeedsAttention: jest.fn(),
    };
    const plan = { entry: null };
    postings = {
      goodsReceived: jest.fn().mockResolvedValue(plan),
      itemSold: jest.fn().mockResolvedValue(plan),
      itemReturned: jest.fn().mockResolvedValue(plan),
      dayClosed: jest.fn().mockReturnValue(plan),
    };
    ledger = { commit: jest.fn().mockResolvedValue({ entryId: "je-1", duplicate: false }) };
    processor = new InboxProcessor(
      inbox as unknown as InboxRepository,
      postings as unknown as PostingsService,
      ledger as unknown as LedgerRepository,
    );
  });

  it.each([
    [EventRoutingKey.GOODS_RECEIVED, "goodsReceived"],
    [EventRoutingKey.ITEM_SOLD, "itemSold"],
    [EventRoutingKey.ITEM_RETURNED, "itemReturned"],
    [EventRoutingKey.DAY_CLOSED, "dayClosed"],
  ] as const)("posts %s through its rule and commits it with the inbox id", async (routingKey, rule) => {
    inbox.findById.mockResolvedValue(stored(routingKey));

    await expect(processor.process("e1")).resolves.toBe("posted");
    expect(postings[rule]).toHaveBeenCalledWith({ eventId: "e1" });
    expect(ledger.commit).toHaveBeenCalledWith({ entry: null }, "e1");
  });

  it("schedules a retry with backoff when another service is down", async () => {
    postings.itemSold.mockRejectedValue(new TransientPostingError("Inventory unreachable"));
    inbox.findById.mockResolvedValue(stored(EventRoutingKey.ITEM_SOLD, 2));

    await expect(processor.process("e1")).resolves.toBe("retry");
    expect(inbox.scheduleRetry).toHaveBeenCalledWith("e1", 3, "Inventory unreachable", expect.any(Date));
    expect(ledger.commit).not.toHaveBeenCalled();
  });

  it("treats an unexpected error (e.g. the database) as retryable too", async () => {
    ledger.commit.mockRejectedValue(new Error("connection reset"));
    await expect(processor.process("e1")).resolves.toBe("retry");
  });

  it("flags an event a person has to fix instead of retrying it forever", async () => {
    postings.itemSold.mockRejectedValue(new PermanentPostingError("Product X not found"));

    await expect(processor.process("e1")).resolves.toBe("needs-attention");
    expect(inbox.markNeedsAttention).toHaveBeenCalledWith("e1", 1, "Product X not found");
    expect(inbox.scheduleRetry).not.toHaveBeenCalled();
  });

  it("flags an event with no posting rule", async () => {
    inbox.findById.mockResolvedValue(stored("stock-low"));
    await expect(processor.process("e1")).resolves.toBe("needs-attention");
  });

  it("skips events that are already posted or flagged", async () => {
    inbox.findById.mockResolvedValue({ ...stored(EventRoutingKey.ITEM_SOLD), status: "POSTED" });
    await expect(processor.process("e1")).resolves.toBe("skipped");
    expect(postings.itemSold).not.toHaveBeenCalled();
  });

  it("sweeps every due event", async () => {
    inbox.findDue.mockResolvedValue([{ eventId: "a" }, { eventId: "b" }]);
    await processor.sweep();
    expect(inbox.findById).toHaveBeenCalledWith("a");
    expect(inbox.findById).toHaveBeenCalledWith("b");
  });
});

describe("backoffMs", () => {
  it("doubles from 15 seconds and caps at an hour", () => {
    expect(backoffMs(1)).toBe(15_000);
    expect(backoffMs(2)).toBe(30_000);
    expect(backoffMs(5)).toBe(240_000);
    expect(backoffMs(20)).toBe(3_600_000);
  });
});
