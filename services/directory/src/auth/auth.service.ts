import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthUser, Role } from "@mms/shared";
import { StaffRepository } from "../staff/staff.repository";
import { LoginThrottle } from "./login-throttle";
import { hashPassword, verifyPassword } from "./password";

const WRONG_CREDENTIALS = "Staff ID or password is incorrect";

type StaffRow = NonNullable<Awaited<ReturnType<StaffRepository["findWithCredentials"]>>>;

/**
 * Directory is the identity owner (D-16): it checks passwords and issues the
 * session token every other service verifies with the shared secret.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly throttle: LoginThrottle,
  ) {}

  async login(rawStaffId: string, password: string): Promise<AuthUser> {
    const staffId = rawStaffId.trim().toLowerCase();
    const waitMs = this.throttle.lockedFor(staffId);
    if (waitMs > 0) {
      throw new HttpException(
        `Too many wrong passwords. Try again in ${Math.ceil(waitMs / 60_000)} minute(s) or ask a manager to reset it.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const person = await this.staff.findWithCredentials(staffId);
    // Always run scrypt, so a response time can't tell which staff ids exist.
    const matches = await verifyPassword(password, person?.passwordHash ?? (await dummyHash()));
    const ok = matches && person?.active === true && person.passwordHash !== null;
    if (!ok || !person) {
      this.throttle.recordFailure(staffId);
      throw new UnauthorizedException(WRONG_CREDENTIALS);
    }

    this.throttle.recordSuccess(staffId);
    await this.staff.recordLogin(staffId);
    return toAuthUser(person);
  }

  /**
   * The current state of the session's person. Rejects a session that was
   * ended by deactivation, a password reset or a role change since it was
   * issued; the caller re-issues a fresh token (sliding session).
   */
  async me(session: AuthUser): Promise<AuthUser> {
    const person = await this.staff.findWithCredentials(session.id);
    if (!person || !person.active || person.sessionVersion !== session.sessionVersion) {
      throw new UnauthorizedException("Your session has ended — sign in again");
    }
    return toAuthUser(person);
  }

  async changePassword(session: AuthUser, currentPassword: string, newPassword: string): Promise<AuthUser> {
    const person = await this.staff.findWithCredentials(session.id);
    if (!person?.passwordHash || !(await verifyPassword(currentPassword, person.passwordHash))) {
      throw new BadRequestException("Current password is incorrect");
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("Choose a password different from the current one");
    }
    const updated = await this.staff.setPassword(person.id, await hashPassword(newPassword), false);
    return toAuthUser(updated);
  }
}

let cachedDummyHash: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  cachedDummyHash ??= hashPassword("no-such-staff-member");
  return cachedDummyHash;
}

export function toAuthUser(person: StaffRow): AuthUser {
  return {
    id: person.id,
    name: person.name,
    role: person.role as unknown as Role,
    locationCode: person.locationCode,
    mustChangePassword: person.mustChangePassword,
    sessionVersion: person.sessionVersion,
  };
}
