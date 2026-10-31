import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { LocationType } from "../../generated/prisma";
import { LocationActivityClient } from "../location-activity.client";
import { LocationsRepository } from "../locations.repository";
import { LocationsService } from "../locations.service";

describe("LocationsService", () => {
  let service: LocationsService;
  let locations: Record<
    "findAll" | "findByCode" | "create" | "update" | "findRegister" | "createRegister" | "countActiveStaff",
    jest.Mock
  >;
  let activity: Record<
    "stockOnHand" | "unclosedBusinessDates" | "transfersInProgress" | "draftGoodsReceivedNotes",
    jest.Mock
  >;

  const store = { code: "STORE-1", name: "Westlands Showroom", type: LocationType.STORE, active: true, registers: [] };
  const warehouse = { code: "WH-01", name: "Main Warehouse", type: LocationType.WAREHOUSE, active: true, registers: [] };

  beforeEach(() => {
    locations = {
      findAll: jest.fn().mockResolvedValue([store, warehouse]),
      findByCode: jest.fn().mockResolvedValue(store),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue(store),
      findRegister: jest.fn().mockResolvedValue(null),
      createRegister: jest.fn().mockImplementation((data) => Promise.resolve({ id: "reg-id", ...data })),
      countActiveStaff: jest.fn().mockResolvedValue(0),
    };
    activity = {
      stockOnHand: jest.fn().mockResolvedValue({ skusOnHand: 0, unitsOnHand: 0 }),
      unclosedBusinessDates: jest.fn().mockResolvedValue([]),
      transfersInProgress: jest.fn().mockResolvedValue(0),
      draftGoodsReceivedNotes: jest.fn().mockResolvedValue(0),
    };
    service = new LocationsService(
      locations as unknown as LocationsRepository,
      activity as unknown as LocationActivityClient,
    );
  });

  it("passes the filter through when listing", async () => {
    await service.list({ type: LocationType.STORE });
    expect(locations.findAll).toHaveBeenCalledWith({ type: LocationType.STORE });
  });

  it("rejects an unknown location code", async () => {
    locations.findByCode.mockResolvedValue(null);
    await expect(service.findOne("NOPE")).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("create", () => {
    const dto = { code: "STORE-3", name: "Karen Showroom", type: LocationType.STORE };

    it("creates a new location", async () => {
      locations.findByCode.mockResolvedValue(null);
      await expect(service.create(dto)).resolves.toEqual(dto);
    });

    it("rejects a duplicate code without writing", async () => {
      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(locations.create).not.toHaveBeenCalled();
    });
  });

  it("updates an existing location", async () => {
    await service.update("STORE-1", { name: "Westlands Flagship" });
    expect(locations.update).toHaveBeenCalledWith("STORE-1", { name: "Westlands Flagship" });
    expect(activity.stockOnHand).not.toHaveBeenCalled();
  });

  describe("deactivationCheck", () => {
    afterEach(() => {
      delete process.env.FEATURE_SALES_AUDIT_ENABLED;
    });

    it("is clear when nothing is left at the location", async () => {
      await expect(service.deactivationCheck("STORE-1")).resolves.toEqual({ blockers: [], warnings: [] });
    });

    it("blocks on stock still on hand", async () => {
      activity.stockOnHand.mockResolvedValue({ skusOnHand: 2, unitsOnHand: 15 });

      const { blockers } = await service.deactivationCheck("STORE-1");
      expect(blockers).toEqual([expect.objectContaining({ kind: "STOCK_ON_HAND" })]);
      expect(blockers[0].message).toContain("15 units of 2 products");
    });

    it("blocks a store on business days that aren't closed", async () => {
      activity.unclosedBusinessDates.mockResolvedValue(["2026-10-31"]);

      const { blockers } = await service.deactivationCheck("STORE-1");
      expect(blockers).toEqual([expect.objectContaining({ kind: "OPEN_BUSINESS_DAYS" })]);
      expect(blockers[0].message).toContain("2026-10-31");
    });

    it("doesn't ask Sales Audit about a warehouse", async () => {
      locations.findByCode.mockResolvedValue(warehouse);

      await service.deactivationCheck("WH-01");
      expect(activity.unclosedBusinessDates).not.toHaveBeenCalled();
    });

    it("only warns about staff, transfers and deliveries", async () => {
      locations.countActiveStaff.mockResolvedValue(3);
      activity.transfersInProgress.mockResolvedValue(1);
      activity.draftGoodsReceivedNotes.mockResolvedValue(2);

      const { blockers, warnings } = await service.deactivationCheck("STORE-1");
      expect(blockers).toEqual([]);
      expect(warnings.map((w) => w.kind).sort()).toEqual([
        "DELIVERIES_IN_PROGRESS",
        "STAFF_ASSIGNED",
        "TRANSFERS_IN_PROGRESS",
      ]);
    });

    it("fails closed when a blocking check can't be made", async () => {
      activity.stockOnHand.mockRejectedValue(new Error("ECONNREFUSED"));

      const { blockers } = await service.deactivationCheck("STORE-1");
      expect(blockers).toEqual([expect.objectContaining({ kind: "CHECK_FAILED" })]);
    });

    it("only warns when a warning check can't be made", async () => {
      activity.transfersInProgress.mockRejectedValue(new Error("ECONNREFUSED"));

      const { blockers, warnings } = await service.deactivationCheck("STORE-1");
      expect(blockers).toEqual([]);
      expect(warnings).toEqual([expect.objectContaining({ kind: "CHECK_FAILED" })]);
    });

    it("skips a module that is switched off", async () => {
      process.env.FEATURE_SALES_AUDIT_ENABLED = "false";

      await service.deactivationCheck("STORE-1");
      expect(activity.unclosedBusinessDates).not.toHaveBeenCalled();
    });
  });

  describe("deactivating", () => {
    it("deactivates when nothing blocks it", async () => {
      await service.update("STORE-1", { active: false });
      expect(locations.update).toHaveBeenCalledWith("STORE-1", { active: false });
    });

    it("refuses while something blocks it, and lists what", async () => {
      activity.unclosedBusinessDates.mockResolvedValue(["2026-10-30"]);

      const error = await service.update("STORE-1", { active: false }).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse().blockers).toEqual([expect.objectContaining({ kind: "OPEN_BUSINESS_DAYS" })]);
      expect(locations.update).not.toHaveBeenCalled();
    });

    it("still deactivates past warnings", async () => {
      locations.countActiveStaff.mockResolvedValue(2);

      await service.update("STORE-1", { active: false });
      expect(locations.update).toHaveBeenCalled();
    });

    it("doesn't re-check a location that is already inactive", async () => {
      locations.findByCode.mockResolvedValue({ ...store, active: false });

      await service.update("STORE-1", { active: false });
      expect(activity.stockOnHand).not.toHaveBeenCalled();
    });

    it("reactivates without any check", async () => {
      locations.findByCode.mockResolvedValue({ ...store, active: false });

      await service.update("STORE-1", { active: true });
      expect(activity.stockOnHand).not.toHaveBeenCalled();
      expect(locations.update).toHaveBeenCalledWith("STORE-1", { active: true });
    });
  });

  describe("addRegister", () => {
    it("adds a register to a store", async () => {
      const register = await service.addRegister("STORE-1", { code: "REG-3", name: "Till 3" });

      expect(locations.createRegister).toHaveBeenCalledWith({ locationCode: "STORE-1", code: "REG-3", name: "Till 3" });
      expect(register).toEqual(expect.objectContaining({ code: "REG-3" }));
    });

    it("rejects a register on a warehouse", async () => {
      locations.findByCode.mockResolvedValue(warehouse);

      await expect(service.addRegister("WH-01", { code: "REG-1", name: "Till" })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(locations.createRegister).not.toHaveBeenCalled();
    });

    it("rejects a register code already used in that store", async () => {
      locations.findRegister.mockResolvedValue({ id: "existing" });

      await expect(service.addRegister("STORE-1", { code: "REG-1", name: "Till" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
