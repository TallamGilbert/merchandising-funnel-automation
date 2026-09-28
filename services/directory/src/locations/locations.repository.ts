import { Injectable } from "@nestjs/common";
import { LocationType, Prisma } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

export interface LocationFilter {
  type?: LocationType;
  includeInactive?: boolean;
}

@Injectable()
export class LocationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: LocationFilter) {
    return this.prisma.location.findMany({
      where: {
        type: filter.type,
        active: filter.includeInactive ? undefined : true,
      },
      include: { registers: { where: { active: true }, orderBy: { code: "asc" } } },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    });
  }

  findByCode(code: string) {
    return this.prisma.location.findUnique({
      where: { code },
      include: { registers: { orderBy: { code: "asc" } } },
    });
  }

  create(data: Prisma.LocationCreateArgs["data"]) {
    return this.prisma.location.create({ data });
  }

  update(code: string, data: Prisma.LocationUpdateArgs["data"]) {
    return this.prisma.location.update({ where: { code }, data });
  }

  findRegister(locationCode: string, code: string) {
    return this.prisma.register.findUnique({
      where: { locationCode_code: { locationCode, code } },
    });
  }

  createRegister(data: Prisma.RegisterUncheckedCreateInput) {
    return this.prisma.register.create({ data });
  }
}
