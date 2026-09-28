import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { StaffRole } from "../../generated/prisma";
import { LocationsRepository } from "../../locations/locations.repository";
import { StaffRepository } from "../staff.repository";
import { StaffService } from "../staff.service";

describe("StaffService", () => {
  let service: StaffService;
  let staff: Record<"findAll" | "findById" | "create" | "update", jest.Mock>;
  let locations: { findByCode: jest.Mock };

  const amy = { id: "cashier-amy", name: "Amy Wanjiru", role: StaffRole.CASHIER, locationCode: "STORE-1" };

  beforeEach(() => {
    staff = {
      findAll: jest.fn().mockResolvedValue([amy]),
      findById: jest.fn().mockResolvedValue(amy),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ ...amy, ...data })),
    };
    locations = { findByCode: jest.fn().mockResolvedValue({ code: "STORE-1" }) };
    service = new StaffService(staff as unknown as StaffRepository, locations as unknown as LocationsRepository);
  });

  it("passes the role/location filter through when listing", async () => {
    await service.list({ roles: [StaffRole.MANAGER, StaffRole.OWNER] });
    expect(staff.findAll).toHaveBeenCalledWith({ roles: [StaffRole.MANAGER, StaffRole.OWNER] });
  });

  it("rejects an unknown staff id", async () => {
    staff.findById.mockResolvedValue(null);
    await expect(service.findOne("nobody")).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("create", () => {
    const dto = { id: "cashier-dan", name: "Dan Mutua", role: StaffRole.CASHIER, locationCode: "STORE-2" };

    it("creates a staff member at an existing location", async () => {
      staff.findById.mockResolvedValue(null);
      await expect(service.create(dto)).resolves.toEqual(dto);
    });

    it("rejects a duplicate id without writing", async () => {
      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(staff.create).not.toHaveBeenCalled();
    });

    it("rejects an unknown home location without writing", async () => {
      staff.findById.mockResolvedValue(null);
      locations.findByCode.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(staff.create).not.toHaveBeenCalled();
    });

    it("allows no home location", async () => {
      staff.findById.mockResolvedValue(null);
      const owner = { id: "owner-zed", name: "Zed", role: StaffRole.OWNER };

      await service.create(owner);
      expect(locations.findByCode).not.toHaveBeenCalled();
      expect(staff.create).toHaveBeenCalledWith(owner);
    });
  });

  describe("update", () => {
    it("changes a staff member's role", async () => {
      const updated = await service.update("cashier-amy", { role: StaffRole.MANAGER });

      expect(staff.update).toHaveBeenCalledWith("cashier-amy", { role: StaffRole.MANAGER });
      expect(updated.role).toBe(StaffRole.MANAGER);
    });

    it("clears the home location without looking it up", async () => {
      await service.update("cashier-amy", { locationCode: null });

      expect(locations.findByCode).not.toHaveBeenCalled();
      expect(staff.update).toHaveBeenCalledWith("cashier-amy", { locationCode: null });
    });

    it("rejects moving to an unknown location", async () => {
      locations.findByCode.mockResolvedValue(null);

      await expect(service.update("cashier-amy", { locationCode: "NOPE" })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(staff.update).not.toHaveBeenCalled();
    });

    it("rejects an unknown staff id without writing", async () => {
      staff.findById.mockResolvedValue(null);

      await expect(service.update("nobody", { role: StaffRole.OWNER })).rejects.toBeInstanceOf(NotFoundException);
      expect(staff.update).not.toHaveBeenCalled();
    });
  });
});
