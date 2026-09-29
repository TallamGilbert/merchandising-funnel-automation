import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AccountsController } from "../../accounts/accounts.controller";
import { AccountsService } from "../../accounts/accounts.service";
import { InboxController } from "../../inbox/inbox.controller";
import { InboxProcessor } from "../../inbox/inbox.processor";
import { InboxRepository } from "../../inbox/inbox.repository";
import { LedgerController } from "../../ledger/ledger.controller";
import { LedgerService } from "../../ledger/ledger.service";
import { PayablesController } from "../../payables/payables.controller";
import { PayablesService } from "../../payables/payables.service";
import { ReportsController } from "../reports.controller";
import { ReportsService } from "../reports.service";

describe("ReportsController", () => {
  const reports = { profitability: jest.fn().mockResolvedValue({}), summary: jest.fn().mockResolvedValue({}) };
  const controller = new ReportsController(reports as unknown as ReportsService);

  it("defaults profitability to by-product", async () => {
    await controller.profitability("2026-09-01", "2026-09-30");
    expect(reports.profitability).toHaveBeenCalledWith("2026-09-01", "2026-09-30", "product");
  });

  it("rejects an unknown grouping and a missing range", () => {
    expect(() => controller.profitability("2026-09-01", "2026-09-30", "region")).toThrow(BadRequestException);
    expect(() => controller.summary("2026-09-01", undefined)).toThrow(BadRequestException);
  });
});

describe("LedgerController", () => {
  const ledger = { entries: jest.fn().mockResolvedValue([]), trialBalance: jest.fn().mockResolvedValue({}) };
  const controller = new LedgerController(ledger as unknown as LedgerService);

  it("passes entry filters through", async () => {
    await controller.entries("2026-09-01", "2026-09-30", "1200", undefined, 50);
    expect(ledger.entries).toHaveBeenCalledWith({ from: "2026-09-01", to: "2026-09-30", accountCode: "1200", source: undefined, limit: 50 });
  });

  it("returns the trial balance as of a date", async () => {
    await controller.trialBalance("2026-09-30");
    expect(ledger.trialBalance).toHaveBeenCalledWith("2026-09-30");
  });
});

describe("PayablesController", () => {
  const payables = { list: jest.fn(), aging: jest.fn(), pay: jest.fn() };
  const controller = new PayablesController(payables as unknown as PayablesService);

  it("lists, ages and pays bills", async () => {
    await controller.list(undefined, "s1");
    expect(payables.list).toHaveBeenCalledWith({ status: undefined, supplierId: "s1" });

    await controller.aging("2026-09-30");
    expect(payables.aging).toHaveBeenCalledWith("2026-09-30");

    await controller.pay("bill-1", { paymentReference: "REF", paidOn: "2026-09-29" });
    expect(payables.pay).toHaveBeenCalledWith("bill-1", "REF", "2026-09-29");
  });
});

describe("InboxController", () => {
  const inbox = { list: jest.fn(), findById: jest.fn(), requeue: jest.fn() };
  const processor = { process: jest.fn().mockResolvedValue("posted") };
  const controller = new InboxController(inbox as unknown as InboxRepository, processor as unknown as InboxProcessor);

  it("requeues a flagged event and posts it straight away", async () => {
    inbox.findById.mockResolvedValue({ eventId: "e1", status: "NEEDS_ATTENTION" });

    await expect(controller.retry("e1")).resolves.toEqual({ eventId: "e1", result: "posted" });
    expect(inbox.requeue).toHaveBeenCalledWith("e1");
  });

  it("leaves a posted event alone", async () => {
    inbox.findById.mockResolvedValue({ eventId: "e1", status: "POSTED" });
    await expect(controller.retry("e1")).resolves.toEqual({ eventId: "e1", result: "already-posted" });
  });

  it("rejects an unknown event", async () => {
    inbox.findById.mockResolvedValue(null);
    await expect(controller.retry("nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("AccountsController", () => {
  it("lists the chart of accounts", async () => {
    const accounts = { list: jest.fn().mockResolvedValue([{ code: "1000" }]) };
    await expect(new AccountsController(accounts as unknown as AccountsService).list()).resolves.toEqual([{ code: "1000" }]);
  });
});
