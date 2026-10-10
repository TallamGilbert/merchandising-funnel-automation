import { randomUUID } from "crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  AuthUser,
  EventBusService,
  EventRoutingKey,
  pageArgs,
  paged,
  Role,
  searchAny,
  StockAdjustedEvent,
} from "@mms/shared";
import {
  InventoryTransactionType,
  Prisma,
  StockCountStatus,
  StockCountType,
} from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateStockCountDto,
  ListStockCountsQuery,
  UncountedHandling,
} from "./dto/stock-count.dto";

/** Statuses in which a count still holds its location (only one at a time). */
const ACTIVE: StockCountStatus[] = [StockCountStatus.OPEN, StockCountStatus.SUBMITTED];
/** Who may see expected quantities on a blind count before it's submitted. */
const REVIEWERS: string[] = [Role.OWNER, Role.MANAGER];

type CountWithLines = Prisma.StockCountGetPayload<{ include: { lines: true } }>;

export interface CountSuggestion {
  sku: string;
  productName: string;
  onHand: number;
  stockValue: number;
  lastCountedAt: string | null;
}

/**
 * D-19 — stocktakes and cycle counts. A count freezes each product's
 * expected on-hand when it's added; counters record what they find; a
 * manager posts the count, which applies every variance in one transaction
 * and publishes StockAdjusted so Financials books the shrinkage.
 */
@Injectable()
export class StockCountsService {
  private readonly logger = new Logger(StockCountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(query: ListStockCountsQuery) {
    const where = {
      status: query.status,
      locationCode: query.locationCode,
      ...searchAny(query.q, ["countNumber"]),
    };
    const [counts, total] = await Promise.all([
      this.prisma.stockCount.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: "desc" },
        ...pageArgs(query),
      }),
      this.prisma.stockCount.count({ where }),
    ]);
    // The list shows totals, never the lines themselves.
    return paged(
      counts.map(({ lines, ...count }) => ({ ...count, ...summarize(lines) })),
      total,
      query,
    );
  }

  /** Expected quantities and variances are hidden from counters on an open blind count. */
  async findOne(id: string, viewer: Pick<AuthUser, "role">) {
    const count = await this.getOrThrow(id);
    const hidden = count.blind && count.status === StockCountStatus.OPEN && !REVIEWERS.includes(viewer.role);
    const lines = count.lines
      .sort((a, b) => a.sku.localeCompare(b.sku))
      .map((line) => ({
        ...line,
        expectedQty: hidden ? null : line.expectedQty,
        variance: hidden || line.countedQty === null ? null : line.countedQty - line.expectedQty,
      }));
    return { ...count, lines, expectedHidden: hidden, ...(hidden ? hiddenSummary(count.lines) : summarize(count.lines)) };
  }

  async create(dto: CreateStockCountDto, user: AuthUser) {
    if (dto.type === StockCountType.FULL && (dto.skus?.length || dto.category)) {
      throw new BadRequestException("A full count covers everything at the location — leave out skus and category");
    }
    if (dto.type === StockCountType.CYCLE && !dto.skus?.length && !dto.category) {
      throw new BadRequestException("A cycle count needs skus or a category");
    }
    const active = await this.prisma.stockCount.findFirst({
      where: { locationCode: dto.locationCode, status: { in: ACTIVE } },
    });
    if (active) {
      throw new ConflictException(
        `${active.countNumber} is still ${active.status.toLowerCase()} at ${dto.locationCode} — post or cancel it first`,
      );
    }

    const products = await this.productsToCount(dto);
    if (products.length === 0) {
      throw new BadRequestException("Nothing to count — no matching products at that location");
    }

    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('"StockCount"', 'sequence')) AS nextval
    `;
    const sequence = Number(nextval);
    return this.prisma.stockCount.create({
      data: {
        sequence,
        countNumber: `SC-${1000 + sequence}`,
        locationCode: dto.locationCode,
        type: dto.type,
        blind: dto.blind ?? true,
        notes: dto.notes,
        createdById: user.id,
        lines: {
          create: products.map((p) => ({
            productId: p.id,
            sku: p.sku,
            productName: p.name,
            expectedQty: p.onHand,
            unitCost: p.unitCost,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /**
   * Records what was found for one SKU. A SKU that turns up but isn't on
   * the count is added, expecting whatever the books say right now.
   */
  async recordCount(id: string, sku: string, countedQty: number, user: AuthUser) {
    const count = await this.getOrThrow(id);
    this.assertStatus(count, StockCountStatus.OPEN, "record counts on");

    const line = count.lines.find((l) => l.sku === sku);
    if (line) {
      await this.prisma.stockCountLine.update({
        where: { id: line.id },
        data: { countedQty, countedById: user.id, countedAt: new Date() },
      });
    } else {
      const product = await this.prisma.product.findUnique({
        where: { sku },
        include: { stockLevels: { where: { locationCode: count.locationCode } } },
      });
      if (!product) throw new NotFoundException(`Product ${sku} not found`);
      await this.prisma.stockCountLine.create({
        data: {
          countId: id,
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          expectedQty: product.stockLevels[0]?.onHand ?? 0,
          unitCost: product.unitCost,
          countedQty,
          countedById: user.id,
          countedAt: new Date(),
        },
      });
    }
    return this.findOne(id, user);
  }

  async submit(id: string, uncounted: UncountedHandling, user: AuthUser) {
    const count = await this.getOrThrow(id);
    this.assertStatus(count, StockCountStatus.OPEN, "submit");

    const missing = count.lines.filter((l) => l.countedQty === null);
    if (missing.length && uncounted === "reject") {
      throw new BadRequestException(
        `${missing.length} line(s) not counted yet (${missing
          .slice(0, 5)
          .map((l) => l.sku)
          .join(", ")}${missing.length > 5 ? ", …" : ""}). Count them, or submit leaving them out or as zero.`,
      );
    }
    const counted = count.lines.length - missing.length;
    if (counted === 0 && uncounted !== "zero") {
      throw new BadRequestException("Nothing has been counted");
    }

    await this.prisma.$transaction([
      ...(uncounted === "zero" && missing.length
        ? [
            this.prisma.stockCountLine.updateMany({
              where: { countId: id, countedQty: null },
              data: { countedQty: 0, countedById: user.id, countedAt: new Date() },
            }),
          ]
        : []),
      this.prisma.stockCount.update({
        where: { id },
        data: { status: StockCountStatus.SUBMITTED, submittedById: user.id, submittedAt: new Date() },
      }),
    ]);
    return this.findOne(id, user);
  }

  /**
   * Applies every variance to current on-hand in one transaction, then
   * publishes StockAdjusted for Financials. Refuses (and changes nothing)
   * if a variance would take on-hand below zero — stock moved since the
   * count, so recount that line.
   */
  async post(id: string, user: AuthUser) {
    const posted = await this.prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
      if (!count) throw new NotFoundException(`Stock count ${id} not found`);
      this.assertStatus(count, StockCountStatus.SUBMITTED, "post");

      const changes = count.lines
        .filter((l) => l.countedQty !== null && l.countedQty !== l.expectedQty)
        .map((l) => ({ line: l, delta: (l.countedQty as number) - l.expectedQty }));

      for (const { line, delta } of changes) {
        const level = await tx.stockLevel.upsert({
          where: { productId_locationCode: { productId: line.productId, locationCode: count.locationCode } },
          create: {
            productId: line.productId,
            locationCode: count.locationCode,
            onHand: delta,
            allocated: 0,
            unitValue: line.unitCost,
          },
          update: { onHand: { increment: delta } },
        });
        if (level.onHand < 0) {
          throw new ConflictException(
            `Posting would leave ${line.sku} at ${level.onHand} on hand — stock moved since it was counted; recount it`,
          );
        }
        await tx.inventoryTransaction.create({
          data: {
            productId: line.productId,
            locationCode: count.locationCode,
            type: InventoryTransactionType.ADJUSTMENT,
            quantityDelta: delta,
            referenceType: "STOCK_COUNT",
            referenceId: count.countNumber,
          },
        });
      }

      const updated = await tx.stockCount.update({
        where: { id },
        data: { status: StockCountStatus.POSTED, postedById: user.id, postedAt: new Date() },
        include: { lines: true },
      });
      return { count: updated, changes };
    });

    if (posted.changes.length) {
      const event: StockAdjustedEvent = {
        eventId: randomUUID(),
        occurredAt: (posted.count.postedAt ?? new Date()).toISOString(),
        kind: "STOCK_COUNT",
        reference: posted.count.countNumber,
        locationCode: posted.count.locationCode,
        description: `Stock count ${posted.count.countNumber}${posted.count.notes ? ` — ${posted.count.notes}` : ""}`,
        adjustedById: user.id,
        lines: posted.changes.map(({ line, delta }) => ({
          sku: line.sku,
          productName: line.productName,
          quantityDelta: delta,
          unitCost: Number(line.unitCost),
        })),
      };
      await this.eventBus.publish(EventRoutingKey.STOCK_ADJUSTED, event);
    }
    this.logger.log(`Posted ${posted.count.countNumber}: ${posted.changes.length} variance line(s)`);
    return this.findOne(id, user);
  }

  async cancel(id: string, user: AuthUser) {
    const count = await this.getOrThrow(id);
    if (!ACTIVE.includes(count.status)) {
      throw new ConflictException(`${count.countNumber} is ${count.status.toLowerCase()} — it can't be cancelled`);
    }
    await this.prisma.stockCount.update({
      where: { id },
      data: { status: StockCountStatus.CANCELLED, cancelledById: user.id, cancelledAt: new Date() },
    });
    return this.findOne(id, user);
  }

  /**
   * What to cycle-count next at a location: products in stock there, never
   * counted first, then the longest since their last posted count; ties go
   * to the most stock value.
   */
  async suggestions(locationCode: string, limit = 20): Promise<CountSuggestion[]> {
    const [levels, countedLines] = await Promise.all([
      this.prisma.stockLevel.findMany({
        where: { locationCode, onHand: { gt: 0 } },
        include: { product: true },
      }),
      this.prisma.stockCountLine.findMany({
        where: { countedQty: { not: null }, count: { locationCode, status: StockCountStatus.POSTED } },
        select: { productId: true, count: { select: { postedAt: true } } },
      }),
    ]);

    const lastCounted = new Map<string, number>();
    for (const line of countedLines) {
      const at = line.count.postedAt?.getTime() ?? 0;
      if (at > (lastCounted.get(line.productId) ?? 0)) lastCounted.set(line.productId, at);
    }

    return levels
      .map((level) => ({
        sku: level.product.sku,
        productName: level.product.name,
        onHand: level.onHand,
        stockValue: Math.round(level.onHand * Number(level.product.unitCost) * 100) / 100,
        counted: lastCounted.get(level.productId) ?? 0,
      }))
      .sort((a, b) => a.counted - b.counted || b.stockValue - a.stockValue)
      .slice(0, Math.min(limit, 100))
      .map(({ counted, ...row }) => ({ ...row, lastCountedAt: counted ? new Date(counted).toISOString() : null }));
  }

  private async productsToCount(dto: CreateStockCountDto) {
    const where: Prisma.ProductWhereInput =
      dto.type === StockCountType.FULL
        ? { stockLevels: { some: { locationCode: dto.locationCode } } }
        : dto.skus?.length
          ? { sku: { in: dto.skus } }
          : { category: { equals: dto.category, mode: "insensitive" } };
    const products = await this.prisma.product.findMany({
      where,
      include: { stockLevels: { where: { locationCode: dto.locationCode } } },
    });
    const unknown = (dto.skus ?? []).filter((sku) => !products.some((p) => p.sku === sku));
    if (unknown.length) throw new NotFoundException(`Unknown SKU(s): ${unknown.join(", ")}`);
    return products.map((p) => ({ ...p, onHand: p.stockLevels[0]?.onHand ?? 0 }));
  }

  private async getOrThrow(id: string): Promise<CountWithLines> {
    const count = await this.prisma.stockCount.findUnique({ where: { id }, include: { lines: true } });
    if (!count) throw new NotFoundException(`Stock count ${id} not found`);
    return count;
  }

  private assertStatus(count: { countNumber: string; status: StockCountStatus }, expected: StockCountStatus, action: string) {
    if (count.status !== expected) {
      throw new ConflictException(`Can't ${action} ${count.countNumber}: it is ${count.status.toLowerCase()}`);
    }
  }
}

type Line = { expectedQty: number; countedQty: number | null; unitCost: Prisma.Decimal | number | string };

/** Progress and variance totals for a count (value at each line's unit cost). */
export function summarize(lines: Line[]) {
  let countedLines = 0;
  let unitsOver = 0;
  let unitsShort = 0;
  let valueCents = 0;
  for (const line of lines) {
    if (line.countedQty === null) continue;
    countedLines++;
    const delta = line.countedQty - line.expectedQty;
    if (delta > 0) unitsOver += delta;
    if (delta < 0) unitsShort -= delta;
    valueCents += Math.round(delta * Number(line.unitCost) * 100);
  }
  return {
    lineCount: lines.length,
    countedLines,
    linesWithVariance: lines.filter((l) => l.countedQty !== null && l.countedQty !== l.expectedQty).length,
    unitsOver,
    unitsShort,
    varianceValue: valueCents / 100,
  };
}

function hiddenSummary(lines: Line[]) {
  return {
    lineCount: lines.length,
    countedLines: lines.filter((l) => l.countedQty !== null).length,
    linesWithVariance: null,
    unitsOver: null,
    unitsShort: null,
    varianceValue: null,
  };
}
