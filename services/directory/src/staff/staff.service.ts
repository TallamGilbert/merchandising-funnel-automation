import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthUser, Role } from "@mms/shared";
import { generateTemporaryPassword, hashPassword } from "../auth/password";
import { StaffRole } from "../generated/prisma";
import { LocationsRepository } from "../locations/locations.repository";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { StaffFilter, StaffRepository } from "./staff.repository";

/** Roles a MANAGER may create, edit and reset. Owners manage everyone (D-17). */
const MANAGER_MANAGEABLE: StaffRole[] = [StaffRole.CASHIER, StaffRole.WAREHOUSE_STAFF];

@Injectable()
export class StaffService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly locations: LocationsRepository,
  ) {}

  list(filter: StaffFilter) {
    return this.staff.findAll(filter);
  }

  async findOne(id: string) {
    const person = await this.staff.findById(id);
    if (!person) throw new NotFoundException(`Staff member ${id} not found`);
    return person;
  }

  /** Returns the new person plus a temporary password, shown to the admin once. */
  async create(actor: AuthUser, dto: CreateStaffDto) {
    assertCanManage(actor, dto.role);
    if (await this.staff.findById(dto.id)) {
      throw new ConflictException(`Staff member ${dto.id} already exists`);
    }
    if (dto.locationCode) await this.assertLocationExists(dto.locationCode);

    const temporaryPassword = generateTemporaryPassword();
    const person = await this.staff.create({
      ...dto,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    });
    return { ...person, temporaryPassword };
  }

  /** Also how a role is changed — the dashboard's role modal sends `{ role }`. */
  async update(actor: AuthUser, id: string, dto: UpdateStaffDto) {
    const person = await this.findOne(id);
    assertCanManage(actor, person.role);
    if (dto.role) assertCanManage(actor, dto.role);
    if (id === actor.id && ((dto.role && dto.role !== person.role) || dto.active === false)) {
      throw new BadRequestException("You can't change your own role or deactivate yourself");
    }
    if (dto.locationCode) await this.assertLocationExists(dto.locationCode);

    // A new role or deactivation must not wait out an open 12-hour session.
    const endsSessions = (dto.role !== undefined && dto.role !== person.role) || dto.active === false;
    return this.staff.update(id, {
      ...dto,
      sessionVersion: endsSessions ? { increment: 1 } : undefined,
    });
  }

  /** Sets a new temporary password (shown once) and signs the person out everywhere. */
  async resetPassword(actor: AuthUser, id: string) {
    const person = await this.findOne(id);
    assertCanManage(actor, person.role);
    if (id === actor.id) {
      throw new BadRequestException("Use Change password to change your own password");
    }
    const temporaryPassword = generateTemporaryPassword();
    await this.staff.setPassword(id, await hashPassword(temporaryPassword), true);
    return { id, temporaryPassword };
  }

  private async assertLocationExists(code: string) {
    if (!(await this.locations.findByCode(code))) {
      throw new BadRequestException(`Location ${code} does not exist`);
    }
  }
}

function assertCanManage(actor: AuthUser, role: StaffRole): void {
  if (actor.role === Role.OWNER) return;
  if (actor.role === Role.MANAGER && MANAGER_MANAGEABLE.includes(role)) return;
  throw new ForbiddenException(
    actor.role === Role.MANAGER
      ? "Managers can only manage cashiers and warehouse staff — ask an owner"
      : "Only owners and managers can manage staff",
  );
}
