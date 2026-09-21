import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoodsReceivedEvent } from "@mms/shared";
import { PutawayTask, PutawayTaskStatus } from "../generated/prisma";
import { InventoryClientService } from "../inventory-client/inventory-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { BinCandidate, footprintFor, selectBin } from "./bin-selection";
import { AssignBinDto } from "./dto/assign-bin.dto";
import { CompletePutawayDto } from "./dto/complete-putaway.dto";

const toCandidate = (bin: {
  id: string;
  code: string;
  pickPriority: number;
  capacityVolumeCm3: unknown;
  maxWeightKg: unknown;
  usedVolumeCm3: unknown;
  usedWeightKg: unknown;
}): BinCandidate => ({
  id: bin.id,
  code: bin.code,
  pickPriority: bin.pickPriority,
  capacityVolumeCm3: Number(bin.capacityVolumeCm3),
  maxWeightKg: Number(bin.maxWeightKg),
  usedVolumeCm3: Number(bin.usedVolumeCm3),
  usedWeightKg: Number(bin.usedWeightKg),
});

@Injectable()
export class PutawayService {
  private readonly logger = new Logger(PutawayService.name);
  private readonly highVelocityUnitsPerDay: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryClientService,
    private readonly config: ConfigService,
  ) {
    this.highVelocityUnitsPerDay = Number(
      this.config.get<string>("HIGH_VELOCITY_UNITS_PER_DAY") ?? 5,
    );
  }

  list(status?: PutawayTaskStatus, locationCode?: string) {
    return this.prisma.putawayTask.findMany({
      where: { status, locationCode },
      include: { bin: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.putawayTask.findUnique({
      where: { id },
      include: { bin: true },
    });
    if (!task) throw new NotFoundException(`Putaway task ${id} not found`);
    return task;
  }

  /**
   * FR-5.6 — one putaway task per received SKU, each directed to a bin
   * straight away (FR-5.1, FR-5.2). DAMAGED lines are skipped: quarantined
   * goods never go to a sellable bin (FR-3.4). If no bin can be chosen the
   * task is still created, unassigned, so nothing received is ever dropped.
   */
  async createFromGoodsReceived(event: GoodsReceivedEvent): Promise<void> {
    for (const line of event.lines) {
      if (line.condition !== "GOOD" || line.quantityReceived <= 0) continue;

      const existing = await this.prisma.putawayTask.findUnique({
        where: { grnNumber_sku: { grnNumber: event.grnNumber, sku: line.sku } },
      });
      if (existing) continue; // event redelivered

      const task = await this.prisma.putawayTask.create({
        data: {
          grnNumber: event.grnNumber,
          poNumber: event.poNumber,
          sku: line.sku,
          productName: line.productName,
          quantity: line.quantityReceived,
          locationCode: event.receivedAtLocation,
        },
      });

      try {
        await this.assignBin(task);
      } catch (error) {
        this.logger.warn(
          `Putaway task ${task.id} (GRN ${event.grnNumber}, ${line.sku}) left unassigned: ${(error as Error).message}`,
        );
      }
    }
  }

  async assign(id: string, dto: AssignBinDto) {
    const task = await this.findOne(id);
    this.assertPending(task);
    await this.assignBin(task, dto.binCode);
    return this.findOne(id);
  }

  /**
   * FR-5.2/FR-5.7 — worker confirms the stock is on the shelf. Inventory is
   * told the bin's absolute quantity *before* the task is committed locally,
   * so a failed call leaves the task open and the retry cannot double-count.
   */
  async complete(id: string, dto: CompletePutawayDto) {
    const task = await this.findOne(id);
    this.assertPending(task);
    if (!task.bin) {
      throw new BadRequestException("No bin has been assigned to this task yet");
    }
    if (dto.scannedBinCode !== task.bin.code) {
      throw new BadRequestException(
        `Scanned bin ${dto.scannedBinCode} but this task directs to ${task.bin.code}`,
      );
    }

    const existing = await this.prisma.binStock.findUnique({
      where: { binId_sku: { binId: task.bin.id, sku: task.sku } },
    });
    const binTotal = (existing?.quantity ?? 0) + task.quantity;

    await this.inventory.confirmBinLocation(task.sku, task.bin.code, {
      locationCode: task.locationCode,
      quantity: binTotal,
    });

    const unitVolumeCm3 = Number(task.reservedVolumeCm3) / task.quantity;
    const unitWeightKg = Number(task.reservedWeightKg) / task.quantity;
    await this.prisma.$transaction([
      this.prisma.putawayTask.update({
        where: { id },
        data: {
          status: PutawayTaskStatus.COMPLETED,
          completedById: dto.completedById,
          completedAt: new Date(),
        },
      }),
      this.prisma.binStock.upsert({
        where: { binId_sku: { binId: task.bin.id, sku: task.sku } },
        create: {
          binId: task.bin.id,
          sku: task.sku,
          quantity: task.quantity,
          unitVolumeCm3,
          unitWeightKg,
        },
        update: {
          quantity: { increment: task.quantity },
          unitVolumeCm3,
          unitWeightKg,
        },
      }),
    ]);

    return this.findOne(id);
  }

  /** Chooses (or validates) a bin, then moves this task's capacity reservation onto it. */
  private async assignBin(task: PutawayTask, binCode?: string): Promise<void> {
    const attributes = await this.inventory.getItemAttributes(task.sku);
    const footprint = footprintFor(attributes, task.quantity);
    const highVelocity =
      attributes.unitsPerDay !== null &&
      attributes.unitsPerDay >= this.highVelocityUnitsPerDay;

    const bins = await this.prisma.bin.findMany({
      where: { locationCode: task.locationCode },
    });
    // The bin being replaced keeps its own reservation until the swap, so
    // treat it as if that space were already free again.
    const candidates = bins.map((bin) => {
      const candidate = toCandidate(bin);
      if (bin.id === task.binId) {
        candidate.usedVolumeCm3 -= Number(task.reservedVolumeCm3);
        candidate.usedWeightKg -= Number(task.reservedWeightKg);
      }
      return candidate;
    });

    let chosen: BinCandidate | undefined;
    if (binCode) {
      const requested = bins.find((bin) => bin.code === binCode);
      if (!requested) throw new NotFoundException(`Bin ${binCode} not found`);
      if (requested.locationCode !== task.locationCode) {
        throw new BadRequestException(
          `Bin ${binCode} is in ${requested.locationCode}, but this stock arrived at ${task.locationCode}`,
        );
      }
      chosen = selectBin(
        candidates.filter((bin) => bin.id === requested.id),
        footprint,
        highVelocity,
      );
      if (!chosen) {
        throw new BadRequestException(`Bin ${binCode} does not have room for this stock`);
      }
    } else {
      chosen = selectBin(candidates, footprint, highVelocity);
      if (!chosen) {
        throw new BadRequestException(
          `No bin in ${task.locationCode} has room for ${task.quantity} × ${task.sku}`,
        );
      }
    }

    await this.prisma.$transaction([
      ...(task.binId && task.binId !== chosen.id
        ? [
            this.prisma.bin.update({
              where: { id: task.binId },
              data: {
                usedVolumeCm3: { decrement: Number(task.reservedVolumeCm3) },
                usedWeightKg: { decrement: Number(task.reservedWeightKg) },
              },
            }),
          ]
        : []),
      ...(task.binId !== chosen.id
        ? [
            this.prisma.bin.update({
              where: { id: chosen.id },
              data: {
                usedVolumeCm3: { increment: footprint.volumeCm3 },
                usedWeightKg: { increment: footprint.weightKg },
              },
            }),
          ]
        : []),
      this.prisma.putawayTask.update({
        where: { id: task.id },
        data: {
          binId: chosen.id,
          reservedVolumeCm3: footprint.volumeCm3,
          reservedWeightKg: footprint.weightKg,
        },
      }),
    ]);
  }

  private assertPending(task: { status: PutawayTaskStatus }): void {
    if (task.status !== PutawayTaskStatus.PENDING) {
      throw new BadRequestException(`Task is already ${task.status}`);
    }
  }
}
