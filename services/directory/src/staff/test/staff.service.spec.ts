import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AuthUser, Role } from "@mms/shared";
import { verifyPassword } from "../../auth/password";
import { StaffRole } from "../../generated/prisma";
import { LocationsRepository } from "../../locations/locations.repository";
import { StaffRepository } from "../staff.repository";
import { StaffService } from "../staff.service";

const actor = (id: string, role: Role): AuthUser => ({
  id,
  name: id,
  role,
  locationCode: null,
  mustChangePassword: false,
  sessionVersion: 0,
});
const owner = actor("owner-wanjiku", Role.OWNER);
const manager = actor("mgr-james", Role.MANAGER);
const cashier = actor("cashier-amy", Role.CASHIER);

describe("StaffService", () => {
  let service: StaffService;
  let staff: Record<"findAll" | "findById" | "create" | "update" | "setPassword", jest.Mock>;
  let locations: { findByCode: jest.Mock };

  const amy = { id: "cashier-amy", name: "Amy Wanjiru", role: StaffRole.CASHIER, locationCode: "STORE-1" };

  beforeEach(() => {
    staff = {
      findAll: jest.fn().mockResolvedValue([amy]),
      findById: jest.fn().mockResolvedValue(amy),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ ...amy, ...data })),
      setPassword: jest.fn().mockResolvedValue({}),
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

    it("creates a staff member with a one-time temporary password they must change", async () => {
      staff.findById.mockResolvedValue(null);

      const created = await service.create(manager, dto);

      expect(created.temporaryPassword).toMatch(/^[A-Za-z2-9]{10}$/);
      const written = staff.create.mock.calls[0][0];
      expect(written).toMatchObject({ ...dto, mustChangePassword: true });
      await expect(verifyPassword(created.temporaryPassword, written.passwordHash)).resolves.toBe(true);
    });

    it("rejects a duplicate id without writing", async () => {
      await expect(service.create(owner, dto)).rejects.toBeInstanceOf(ConflictException);
      expect(staff.create).not.toHaveBeenCalled();
    });

    it("rejects an unknown home location without writing", async () => {
      staff.findById.mockResolvedValue(null);
      locations.findByCode.mockResolvedValue(null);

      await expect(service.create(owner, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(staff.create).not.toHaveBeenCalled();
    });

    it("allows no home location", async () => {
      staff.findById.mockResolvedValue(null);
      await service.create(owner, { id: "owner-zed", name: "Zed", role: StaffRole.OWNER });
      expect(locations.findByCode).not.toHaveBeenCalled();
    });

    it.each([StaffRole.OWNER, StaffRole.MANAGER, StaffRole.BUYER, StaffRole.ACCOUNTANT])(
      "does not let a manager create a %s",
      async (role) => {
        staff.findById.mockResolvedValue(null);
        await expect(service.create(manager, { ...dto, role })).rejects.toBeInstanceOf(ForbiddenException);
        expect(staff.create).not.toHaveBeenCalled();
      },
    );

    it("does not let a cashier create anyone", async () => {
      staff.findById.mockResolvedValue(null);
      await expect(service.create(cashier, dto)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("update", () => {
    it("changes a role and ends the person's open sessions", async () => {
      const updated = await service.update(owner, "cashier-amy", { role: StaffRole.MANAGER });

      expect(staff.update).toHaveBeenCalledWith("cashier-amy", {
        role: StaffRole.MANAGER,
        sessionVersion: { increment: 1 },
      });
      expect(updated.role).toBe(StaffRole.MANAGER);
    });

    it("ends open sessions on deactivation", async () => {
      await service.update(manager, "cashier-amy", { active: false });
      expect(staff.update).toHaveBeenCalledWith("cashier-amy", { active: false, sessionVersion: { increment: 1 } });
    });

    it("keeps sessions for a rename or location move", async () => {
      await service.update(manager, "cashier-amy", { locationCode: null });

      expect(locations.findByCode).not.toHaveBeenCalled();
      expect(staff.update).toHaveBeenCalledWith("cashier-amy", { locationCode: null, sessionVersion: undefined });
    });

    it("does not let a manager promote someone to manager", async () => {
      await expect(service.update(manager, "cashier-amy", { role: StaffRole.MANAGER })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(staff.update).not.toHaveBeenCalled();
    });

    it("does not let a manager edit another manager", async () => {
      staff.findById.mockResolvedValue({ ...amy, id: "mgr-faith", role: StaffRole.MANAGER });
      await expect(service.update(manager, "mgr-faith", { name: "F" })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("does not let anyone demote or deactivate themselves", async () => {
      staff.findById.mockResolvedValue({ ...amy, id: owner.id, role: StaffRole.OWNER });

      await expect(service.update(owner, owner.id, { role: StaffRole.MANAGER })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.update(owner, owner.id, { active: false })).rejects.toBeInstanceOf(BadRequestException);
      expect(staff.update).not.toHaveBeenCalled();
    });

    it("rejects moving to an unknown location", async () => {
      locations.findByCode.mockResolvedValue(null);

      await expect(service.update(owner, "cashier-amy", { locationCode: "NOPE" })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(staff.update).not.toHaveBeenCalled();
    });

    it("rejects an unknown staff id without writing", async () => {
      staff.findById.mockResolvedValue(null);

      await expect(service.update(owner, "nobody", { role: StaffRole.OWNER })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(staff.update).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("sets a temporary password that must be changed", async () => {
      const { temporaryPassword } = await service.resetPassword(manager, "cashier-amy");

      const [id, hash, mustChange] = staff.setPassword.mock.calls[0];
      expect(id).toBe("cashier-amy");
      expect(mustChange).toBe(true);
      await expect(verifyPassword(temporaryPassword, hash)).resolves.toBe(true);
    });

    it("does not let a manager reset an owner", async () => {
      staff.findById.mockResolvedValue({ ...amy, id: owner.id, role: StaffRole.OWNER });
      await expect(service.resetPassword(manager, owner.id)).rejects.toBeInstanceOf(ForbiddenException);
      expect(staff.setPassword).not.toHaveBeenCalled();
    });

    it("sends people to Change password for their own", async () => {
      staff.findById.mockResolvedValue({ ...amy, id: owner.id, role: StaffRole.OWNER });
      await expect(service.resetPassword(owner, owner.id)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
