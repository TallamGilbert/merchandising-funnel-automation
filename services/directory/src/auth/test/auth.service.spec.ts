import { BadRequestException, HttpException, HttpStatus, UnauthorizedException } from "@nestjs/common";
import { AuthUser, Role } from "@mms/shared";
import { StaffRole } from "../../generated/prisma";
import { StaffRepository } from "../../staff/staff.repository";
import { AuthService } from "../auth.service";
import { LoginThrottle, MAX_FAILED_ATTEMPTS } from "../login-throttle";
import { hashPassword, verifyPassword } from "../password";

describe("AuthService", () => {
  let service: AuthService;
  let staff: Record<"findWithCredentials" | "recordLogin" | "setPassword", jest.Mock>;
  let sam: Record<string, unknown>;

  beforeAll(async () => {
    sam = {
      id: "mgr-sam",
      name: "Sam Otieno",
      role: StaffRole.MANAGER,
      locationCode: "WH-MAIN",
      active: true,
      passwordHash: await hashPassword("correct horse"),
      mustChangePassword: false,
      sessionVersion: 2,
    };
  });

  beforeEach(() => {
    staff = {
      findWithCredentials: jest.fn().mockResolvedValue(sam),
      recordLogin: jest.fn().mockResolvedValue({}),
      setPassword: jest.fn().mockImplementation((id, passwordHash, mustChangePassword) =>
        Promise.resolve({ ...sam, passwordHash, mustChangePassword, sessionVersion: 3 }),
      ),
    };
    service = new AuthService(staff as unknown as StaffRepository, new LoginThrottle());
  });

  describe("login", () => {
    it("returns the session user for the right password", async () => {
      await expect(service.login("mgr-sam", "correct horse")).resolves.toEqual({
        id: "mgr-sam",
        name: "Sam Otieno",
        role: Role.MANAGER,
        locationCode: "WH-MAIN",
        mustChangePassword: false,
        sessionVersion: 2,
      });
      expect(staff.recordLogin).toHaveBeenCalledWith("mgr-sam");
    });

    it("ignores case and surrounding spaces in the staff id", async () => {
      await service.login("  MGR-Sam ", "correct horse");
      expect(staff.findWithCredentials).toHaveBeenCalledWith("mgr-sam");
    });

    it("rejects a wrong password", async () => {
      await expect(service.login("mgr-sam", "wrong")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(staff.recordLogin).not.toHaveBeenCalled();
    });

    it("gives the same answer for an unknown id, an inactive person and one without a password", async () => {
      const messages: string[] = [];
      for (const row of [null, { ...sam, active: false }, { ...sam, passwordHash: null }]) {
        staff.findWithCredentials.mockResolvedValueOnce(row);
        await service.login("mgr-sam", "correct horse").catch((e: Error) => messages.push(e.message));
      }
      expect(new Set(messages).size).toBe(1);
      expect(messages).toHaveLength(3);
    });

    it("locks the id after repeated wrong passwords, even for the right one", async () => {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        await service.login("mgr-sam", "wrong").catch(() => undefined);
      }
      const error = await service.login("mgr-sam", "correct horse").catch((e: HttpException) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe("me", () => {
    const session = { id: "mgr-sam", sessionVersion: 2 } as AuthUser;

    it("returns the current state of the person", async () => {
      await expect(service.me(session)).resolves.toMatchObject({ id: "mgr-sam", role: Role.MANAGER });
    });

    it("ends a session issued before a reset, role change or deactivation", async () => {
      staff.findWithCredentials.mockResolvedValue({ ...sam, sessionVersion: 3 });
      await expect(service.me(session)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("ends the session of a deactivated person", async () => {
      staff.findWithCredentials.mockResolvedValue({ ...sam, active: false });
      await expect(service.me(session)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("changePassword", () => {
    const session = { id: "mgr-sam" } as AuthUser;

    it("stores the new password and clears the must-change flag", async () => {
      const user = await service.changePassword(session, "correct horse", "battery staple");

      const [id, hash, mustChange] = staff.setPassword.mock.calls[0];
      expect(id).toBe("mgr-sam");
      expect(mustChange).toBe(false);
      await expect(verifyPassword("battery staple", hash)).resolves.toBe(true);
      expect(user.sessionVersion).toBe(3);
    });

    it("requires the current password", async () => {
      await expect(service.changePassword(session, "wrong", "battery staple")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(staff.setPassword).not.toHaveBeenCalled();
    });

    it("refuses to keep the same (e.g. temporary) password", async () => {
      await expect(service.changePassword(session, "correct horse", "correct horse")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
