import { Injectable } from "@nestjs/common";
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
}
