import { BadRequestException } from "@nestjs/common";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";

describe("LedgerController", () => {
  let controller: LedgerController;
  let ledger: { getLedger: jest.Mock };

  beforeEach(() => {
    ledger = { getLedger: jest.fn().mockResolvedValue({ id: "ledger-1", cashierLines: [] }) };
    controller = new LedgerController(ledger as unknown as LedgerService);
  });

  it("returns the store-day ledger", async () => {
    await expect(controller.get("STORE-1", "2026-09-24")).resolves.toEqual(
      expect.objectContaining({ id: "ledger-1" }),
    );
    expect(ledger.getLedger).toHaveBeenCalledWith("STORE-1", "2026-09-24");
  });

  it("rejects a request without a businessDate", async () => {
    await expect(controller.get("STORE-1", undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(ledger.getLedger).not.toHaveBeenCalled();
  });
});
