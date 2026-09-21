import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PickTaskStatus, TransferStatus } from "../generated/prisma";
import { InventoryClientService } from "../inventory-client/inventory-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { CompletePickDto } from "./dto/complete-pick.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryClientService,
  ) {}

  list(status?: TransferStatus) {
    return this.prisma.transfer.findMany({
      where: status ? { status } : undefined,
      include: { picks: { include: { bin: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: { picks: { include: { bin: true } } },
    });
    if (!transfer) throw new NotFoundException(`Transfer ${id} not found`);
    return transfer;
  }

  /**
   * FR-5.3/FR-5.4 — requests a transfer and directs the pickers. Picks are
   * drawn from the source location's bins nearest dispatch first, emptying
   * smaller bins before larger ones. Quantities already promised to other
   * open picks are not offered twice.
   */
  async create(dto: CreateTransferDto) {
    if (dto.fromLocationCode === dto.toLocationCode) {
      throw new BadRequestException("Source and destination locations must differ");
    }

    const [binStock, openPicks] = await Promise.all([
      this.prisma.binStock.findMany({
        where: {
          sku: dto.sku,
          quantity: { gt: 0 },
          bin: { locationCode: dto.fromLocationCode },
        },
        include: { bin: true },
      }),
      this.prisma.pickTask.findMany({
        where: {
          sku: dto.sku,
          status: PickTaskStatus.PENDING,
          bin: { locationCode: dto.fromLocationCode },
        },
      }),
    ]);

    const promised = new Map<string, number>();
    for (const pick of openPicks) {
      promised.set(pick.binId, (promised.get(pick.binId) ?? 0) + pick.quantity);
    }

    const sources = binStock
      .map((stock) => ({
        binId: stock.binId,
        pickPriority: stock.bin.pickPriority,
        available: stock.quantity - (promised.get(stock.binId) ?? 0),
      }))
      .filter((source) => source.available > 0)
      .sort(
        (a, b) =>
          a.pickPriority - b.pickPriority || a.available - b.available,
      );

    let remaining = dto.quantity;
    const picks: { binId: string; sku: string; quantity: number }[] = [];
    for (const source of sources) {
      if (remaining === 0) break;
      const quantity = Math.min(source.available, remaining);
      picks.push({ binId: source.binId, sku: dto.sku, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) {
      throw new BadRequestException(
        `Only ${dto.quantity - remaining} of ${dto.quantity} × ${dto.sku} are in ${dto.fromLocationCode}'s bins`,
      );
    }

    // Pull the next value of the same Postgres sequence backing
    // Transfer.sequence so transferNumber can be set in a single insert.
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('"Transfer"', 'sequence')) AS nextval
    `;
    const sequence = Number(nextval);

    return this.prisma.transfer.create({
      data: {
        sequence,
        transferNumber: `TRF-${1000 + sequence}`,
        sku: dto.sku,
        quantity: dto.quantity,
        fromLocationCode: dto.fromLocationCode,
        toLocationCode: dto.toLocationCode,
        requestedById: dto.requestedById,
        picks: { create: picks },
      },
      include: { picks: { include: { bin: true } } },
    });
  }

  /**
   * FR-5.3 — picker confirms a pick. Removes the quantity from the bin,
   * frees its reserved capacity, and completes the transfer once its last
   * pick is in.
   */
  async completePick(id: string, dto: CompletePickDto) {
    const pick = await this.prisma.pickTask.findUnique({
      where: { id },
      include: { bin: true },
    });
    if (!pick) throw new NotFoundException(`Pick task ${id} not found`);
    if (pick.status !== PickTaskStatus.PENDING) {
      throw new BadRequestException(`Pick is already ${pick.status}`);
    }
    if (dto.scannedBinCode !== pick.bin.code) {
      throw new BadRequestException(
        `Scanned bin ${dto.scannedBinCode} but this pick is from ${pick.bin.code}`,
      );
    }

    const stock = await this.prisma.binStock.findUnique({
      where: { binId_sku: { binId: pick.binId, sku: pick.sku } },
    });
    if (!stock || stock.quantity < pick.quantity) {
      throw new BadRequestException(
        `Bin ${pick.bin.code} no longer holds ${pick.quantity} × ${pick.sku}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.pickTask.update({
        where: { id },
        data: {
          status: PickTaskStatus.PICKED,
          pickedById: dto.pickedById,
          pickedAt: new Date(),
        },
      }),
      this.prisma.binStock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: pick.quantity } },
      }),
      this.prisma.bin.update({
        where: { id: pick.binId },
        data: {
          usedVolumeCm3: { decrement: Number(stock.unitVolumeCm3) * pick.quantity },
          usedWeightKg: { decrement: Number(stock.unitWeightKg) * pick.quantity },
        },
      }),
    ]);

    const stillPending = await this.prisma.pickTask.count({
      where: { transferId: pick.transferId, status: PickTaskStatus.PENDING },
    });
    if (stillPending === 0) {
      await this.prisma.transfer.update({
        where: { id: pick.transferId },
        data: { status: TransferStatus.COMPLETED, completedAt: new Date() },
      });
    }

    // Best effort: the pick is physically done either way, so a failed call
    // must not block the floor. Inventory's bin record is corrected by the
    // next putaway into this bin, which re-sends the absolute quantity.
    try {
      await this.inventory.confirmBinLocation(pick.sku, pick.bin.code, {
        locationCode: pick.bin.locationCode,
        quantity: stock.quantity - pick.quantity,
      });
    } catch (error) {
      this.logger.warn(
        `Could not sync bin ${pick.bin.code} to Inventory after pick ${id}: ${(error as Error).message}`,
      );
    }

    return this.findOne(pick.transferId);
  }
}
