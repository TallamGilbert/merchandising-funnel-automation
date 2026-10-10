import { Injectable } from "@nestjs/common";
import { StaffRole } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { DemoDirectory } from "./demo-directory";

@Injectable()
export class SeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isEmpty(): Promise<boolean> {
    return (await this.prisma.location.count()) === 0;
  }

  /** Locations first — registers and staff reference them. All or nothing. */
  async insert(directory: DemoDirectory): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.location.createMany({ data: directory.locations }),
      this.prisma.register.createMany({ data: directory.registers }),
      this.prisma.staff.createMany({ data: directory.staff }),
    ]);
  }

  /** Demo passwords are known to everyone, so no forced change. Returns how many were set. */
  async setPasswordWhereUnset(ids: string[], passwordHash: string): Promise<number> {
    const { count } = await this.prisma.staff.updateMany({
      where: { id: { in: ids }, passwordHash: null },
      data: { passwordHash, mustChangePassword: false },
    });
    return count;
  }

  async ownerCanSignIn(): Promise<boolean> {
    const count = await this.prisma.staff.count({
      where: { role: StaffRole.OWNER, active: true, passwordHash: { not: null } },
    });
    return count > 0;
  }

  upsertOwner(id: string, name: string, passwordHash: string) {
    const credentials = { passwordHash, mustChangePassword: true, active: true, role: StaffRole.OWNER };
    return this.prisma.staff.upsert({
      where: { id },
      create: { id, name, ...credentials },
      update: { ...credentials, sessionVersion: { increment: 1 } },
    });
  }
}
