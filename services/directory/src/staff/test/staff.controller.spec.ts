import { BadRequestException } from "@nestjs/common";
import { StaffRole } from "../../generated/prisma";
import { StaffController } from "../staff.controller";
import { StaffService } from "../staff.service";

describe("StaffController", () => {
  let controller: StaffController;
  let staff: Record<"list" | "create" | "findOne" | "update", jest.Mock>;

  beforeEach(() => {
    staff = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    };
    controller = new StaffController(staff as unknown as StaffService);
  });

  describe("list", () => {
    it("lists everyone when no role is given", async () => {
      await controller.list(undefined, undefined, undefined);
      expect(staff.list).toHaveBeenCalledWith({ roles: undefined, locationCode: undefined, includeInactive: undefined });
    });

    it("accepts several comma-separated roles, case-insensitively", async () => {
      await controller.list("manager, Owner", "STORE-1", undefined);
      expect(staff.list).toHaveBeenCalledWith({
        roles: [StaffRole.MANAGER, StaffRole.OWNER],
        locationCode: "STORE-1",
        includeInactive: undefined,
      });
    });

    it("rejects an unknown role", () => {
      expect(() => controller.list("JANITOR", undefined, undefined)).toThrow(BadRequestException);
      expect(staff.list).not.toHaveBeenCalled();
    });
  });

  it("creates a staff member from the body", async () => {
    const dto = { id: "cashier-dan", name: "Dan", role: StaffRole.CASHIER };
    await controller.create(dto);
    expect(staff.create).toHaveBeenCalledWith(dto);
  });

  it("finds one staff member by id", async () => {
    await controller.findOne("cashier-amy");
    expect(staff.findOne).toHaveBeenCalledWith("cashier-amy");
  });

  it("updates a staff member's role", async () => {
    await controller.update("cashier-amy", { role: StaffRole.MANAGER });
    expect(staff.update).toHaveBeenCalledWith("cashier-amy", { role: StaffRole.MANAGER });
  });
});
