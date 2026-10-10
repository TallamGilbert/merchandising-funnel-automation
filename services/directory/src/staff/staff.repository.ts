import { Injectable } from "@nestjs/common";
import { Prisma, StaffRole } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

export interface StaffFilter {
  roles?: StaffRole[];
  locationCode?: string;
  includeInactive?: boolean;
}

/** Everything about a person except their credentials — what the API returns. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  role: true,
  locationCode: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffSelect;

export type PublicStaff = Prisma.StaffGetPayload<{ select: typeof PUBLIC_FIELDS }>;

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: StaffFilter) {
    return this.prisma.staff.findMany({
      select: PUBLIC_FIELDS,
      where: {
        role: filter.roles?.length ? { in: filter.roles } : undefined,
        locationCode: filter.locationCode,
        active: filter.includeInactive ? undefined : true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.staff.findUnique({ select: PUBLIC_FIELDS, where: { id } });
  }

  create(data: Prisma.StaffUncheckedCreateInput) {
    return this.prisma.staff.create({ select: PUBLIC_FIELDS, data });
  }

  update(id: string, data: Prisma.StaffUncheckedUpdateInput) {
    return this.prisma.staff.update({ select: PUBLIC_FIELDS, where: { id }, data });
  }

  /** Auth only: the full row, including the password hash and session version. */
  findWithCredentials(id: string) {
    return this.prisma.staff.findUnique({ where: { id } });
  }

  /** Sets a password hash; bumps the session version so other open sessions end. */
  setPassword(id: string, passwordHash: string, mustChangePassword: boolean) {
    return this.prisma.staff.update({
      where: { id },
      data: { passwordHash, mustChangePassword, sessionVersion: { increment: 1 } },
    });
  }

  recordLogin(id: string) {
    return this.prisma.staff.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }
}
