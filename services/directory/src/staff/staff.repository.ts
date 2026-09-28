import { Injectable } from "@nestjs/common";
import { Prisma, StaffRole } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

export interface StaffFilter {
  roles?: StaffRole[];
  locationCode?: string;
  includeInactive?: boolean;
}

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: StaffFilter) {
    return this.prisma.staff.findMany({
      where: {
        role: filter.roles?.length ? { in: filter.roles } : undefined,
        locationCode: filter.locationCode,
        active: filter.includeInactive ? undefined : true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.staff.findUnique({ where: { id } });
  }

  create(data: Prisma.StaffUncheckedCreateInput) {
    return this.prisma.staff.create({ data });
  }

  update(id: string, data: Prisma.StaffUncheckedUpdateInput) {
    return this.prisma.staff.update({ where: { id }, data });
  }
}
