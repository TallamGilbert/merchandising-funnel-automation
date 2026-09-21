import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBinDto } from "./dto/create-bin.dto";

const pct = (used: number, capacity: number) =>
  capacity === 0 ? 0 : Math.round((used / capacity) * 1000) / 10;

@Injectable()
export class BinsService {
  constructor(private readonly prisma: PrismaService) {}

  list(locationCode?: string) {
    return this.prisma.bin.findMany({
      where: locationCode ? { locationCode } : undefined,
      include: { stock: true },
      orderBy: [{ locationCode: "asc" }, { code: "asc" }],
    });
  }

  async create(dto: CreateBinDto) {
    const existing = await this.prisma.bin.count({ where: { code: dto.code } });
    if (existing > 0) {
      throw new ConflictException(`Bin ${dto.code} already exists`);
    }
    return this.prisma.bin.create({ data: dto });
  }

  async findByCode(code: string) {
    const bin = await this.prisma.bin.findUnique({
      where: { code },
      include: { stock: true },
    });
    if (!bin) throw new NotFoundException(`Bin ${code} not found`);
    return bin;
  }

  /** FR-5.5 — capacity and utilization per location and zone. */
  async utilization(locationCode?: string) {
    const bins = await this.prisma.bin.findMany({
      where: locationCode ? { locationCode } : undefined,
    });

    const groups = new Map<
      string,
      {
        locationCode: string;
        zone: string;
        binCount: number;
        capacityVolumeCm3: number;
        usedVolumeCm3: number;
        maxWeightKg: number;
        usedWeightKg: number;
      }
    >();
    for (const bin of bins) {
      const key = `${bin.locationCode}::${bin.zone}`;
      const group = groups.get(key) ?? {
        locationCode: bin.locationCode,
        zone: bin.zone,
        binCount: 0,
        capacityVolumeCm3: 0,
        usedVolumeCm3: 0,
        maxWeightKg: 0,
        usedWeightKg: 0,
      };
      group.binCount += 1;
      group.capacityVolumeCm3 += Number(bin.capacityVolumeCm3);
      group.usedVolumeCm3 += Number(bin.usedVolumeCm3);
      group.maxWeightKg += Number(bin.maxWeightKg);
      group.usedWeightKg += Number(bin.usedWeightKg);
      groups.set(key, group);
    }

    return [...groups.values()].map((group) => ({
      ...group,
      volumeUtilizationPct: pct(group.usedVolumeCm3, group.capacityVolumeCm3),
      weightUtilizationPct: pct(group.usedWeightKg, group.maxWeightKg),
    }));
  }
}
