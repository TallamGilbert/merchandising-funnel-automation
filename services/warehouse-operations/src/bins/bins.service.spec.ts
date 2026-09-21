import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BinsService } from "./bins.service";

describe("BinsService", () => {
  let service: BinsService;
  let prisma: { bin: Record<string, jest.Mock> };

  beforeEach(() => {
    prisma = { bin: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), findUnique: jest.fn() } };
    service = new BinsService(prisma as unknown as PrismaService);
  });

  it("rejects a duplicate bin code", async () => {
    prisma.bin.count.mockResolvedValue(1);

    await expect(
      service.create({
        code: "A-01", locationCode: "WH-MAIN", zone: "FAST-PICK",
        capacityVolumeCm3: 1000, maxWeightKg: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rolls bins up into per-zone utilization (FR-5.5)", async () => {
    const bin = (used: string, zone: string) => ({
      locationCode: "WH-MAIN", zone,
      capacityVolumeCm3: "1000", usedVolumeCm3: used,
      maxWeightKg: "100", usedWeightKg: "25",
    });
    prisma.bin.findMany.mockResolvedValue([bin("250", "FAST"), bin("750", "FAST"), bin("0", "BULK")]);

    const result = await service.utilization("WH-MAIN");

    expect(result).toEqual([
      expect.objectContaining({
        zone: "FAST", binCount: 2, capacityVolumeCm3: 2000, usedVolumeCm3: 1000,
        volumeUtilizationPct: 50, weightUtilizationPct: 25,
      }),
      expect.objectContaining({ zone: "BULK", binCount: 1, volumeUtilizationPct: 0 }),
    ]);
  });
});
