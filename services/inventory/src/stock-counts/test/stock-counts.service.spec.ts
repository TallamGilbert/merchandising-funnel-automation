import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AuthUser, EventBusService, EventRoutingKey, Role } from "@mms/shared";
import { StockCountStatus, StockCountType } from "../../generated/prisma";
import { PrismaService } from "../../prisma/prisma.service";
import { StockCountsService, summarize } from "../stock-counts.service";

const manager = { id: "mgr-sam", role: Role.MANAGER } as AuthUser;
const picker = { id: "picker-lucy", role: Role.WAREHOUSE_STAFF } as AuthUser;

function line(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    countId: "c1",
    productId: "p1",
    sku: "SOFA-1",
    productName: "Sofa",
    expectedQty: 10,
    countedQty: null as number | null,
    countedById: null,
    countedAt: null,
    unitCost: 5000,
    ...overrides,
  };
}

function count(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    sequence: 1,
    countNumber: "SC-1001",
    locationCode: "WH-MAIN",
    type: StockCountType.FULL,
    status: StockCountStatus.OPEN,
    blind: true,
    notes: null,
    createdById: "mgr-sam",
    postedAt: null,
    lines: [line()],
    ...overrides,
  };
}

describe("StockCountsService", () => {
  let service: StockCountsService;
  type ModelMock = Record<string, jest.Mock>;
  let prisma: {
    stockCount: ModelMock;
    stockCountLine: ModelMock;
    product: ModelMock;
    stockLevel: ModelMock;
    inventoryTransaction: ModelMock;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    prisma = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(count()),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "c1", ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(count(data))),
      },
      stockCountLine: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      stockLevel: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(7) }]),
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[]),
      ),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new StockCountsService(prisma as unknown as PrismaService, eventBus as unknown as EventBusService);
  });

  describe("create", () => {
    it("freezes each product's current on-hand as the expected quantity", async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: "p1", sku: "SOFA-1", name: "Sofa", unitCost: 5000, stockLevels: [{ onHand: 4 }] },
        { id: "p2", sku: "LAMP-1", name: "Lamp", unitCost: 800, stockLevels: [] },
      ]);

      const created = await service.create({ locationCode: "WH-MAIN", type: StockCountType.FULL }, manager);

      expect(created.countNumber).toBe("SC-1007");
      expect(prisma.stockCount.create.mock.calls[0][0].data).toMatchObject({
        blind: true,
        createdById: "mgr-sam",
        lines: {
          create: [
            { productId: "p1", sku: "SOFA-1", expectedQty: 4, unitCost: 5000 },
            { productId: "p2", sku: "LAMP-1", expectedQty: 0, unitCost: 800 },
          ],
        },
      });
    });

    it("counts a category case-insensitively for a cycle count", async () => {
      prisma.product.findMany.mockResolvedValue([{ id: "p1", sku: "SOFA-1", name: "Sofa", unitCost: 1, stockLevels: [] }]);
      await service.create({ locationCode: "WH-MAIN", type: StockCountType.CYCLE, category: "sofas" }, manager);
      expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({
        category: { equals: "sofas", mode: "insensitive" },
      });
    });

    it("rejects unknown SKUs on a cycle count", async () => {
      prisma.product.findMany.mockResolvedValue([{ id: "p1", sku: "SOFA-1", name: "Sofa", unitCost: 1, stockLevels: [] }]);
      await expect(
        service.create({ locationCode: "WH-MAIN", type: StockCountType.CYCLE, skus: ["SOFA-1", "NOPE"] }, manager),
      ).rejects.toThrow("Unknown SKU(s): NOPE");
    });

    it("allows only one open or submitted count per location", async () => {
      prisma.stockCount.findFirst.mockResolvedValue({ countNumber: "SC-1001", status: StockCountStatus.OPEN });
      await expect(service.create({ locationCode: "WH-MAIN", type: StockCountType.FULL }, manager)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it.each([
      [{ type: StockCountType.FULL, skus: ["SOFA-1"] }],
      [{ type: StockCountType.CYCLE }],
    ])("rejects a mismatched scope %p", async (dto) => {
      await expect(service.create({ locationCode: "WH-MAIN", ...dto }, manager)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("refuses an empty count", async () => {
      await expect(service.create({ locationCode: "EMPTY", type: StockCountType.FULL }, manager)).rejects.toThrow(
        "Nothing to count",
      );
    });
  });

  describe("findOne", () => {
    it("hides expected quantities from counters on an open blind count", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(count({ lines: [line({ countedQty: 8 })] }));
      const view = await service.findOne("c1", picker);
      expect(view.expectedHidden).toBe(true);
      expect(view.lines[0]).toMatchObject({ countedQty: 8, expectedQty: null, variance: null });
      expect(view.varianceValue).toBeNull();
    });

    it("shows them to managers, with the variance", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(count({ lines: [line({ countedQty: 8 })] }));
      const view = await service.findOne("c1", manager);
      expect(view.lines[0]).toMatchObject({ expectedQty: 10, variance: -2 });
      expect(view.varianceValue).toBe(-10000);
    });

    it("shows them to everyone once submitted", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(count({ status: StockCountStatus.SUBMITTED }));
      expect((await service.findOne("c1", picker)).expectedHidden).toBe(false);
    });
  });

  describe("recordCount", () => {
    it("records what was found and who found it", async () => {
      await service.recordCount("c1", "SOFA-1", 8, picker);
      expect(prisma.stockCountLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: expect.objectContaining({ countedQty: 8, countedById: "picker-lucy" }),
      });
    });

    it("adds a SKU found but not on the count, expecting what the books say now", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: "p9",
        sku: "CHAIR-9",
        name: "Chair",
        unitCost: 300,
        stockLevels: [{ onHand: 2 }],
      });
      await service.recordCount("c1", "CHAIR-9", 3, picker);
      expect(prisma.stockCountLine.create.mock.calls[0][0].data).toMatchObject({
        productId: "p9",
        expectedQty: 2,
        countedQty: 3,
      });
    });

    it("rejects an unknown SKU", async () => {
      await expect(service.recordCount("c1", "NOPE", 1, picker)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses once the count is submitted", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(count({ status: StockCountStatus.SUBMITTED }));
      await expect(service.recordCount("c1", "SOFA-1", 1, picker)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("submit", () => {
    const twoLines = count({ lines: [line({ countedQty: 9 }), line({ id: "l2", sku: "LAMP-1", countedQty: null })] });

    it("refuses while lines are uncounted, naming them", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(twoLines);
      await expect(service.submit("c1", "reject", picker)).rejects.toThrow("1 line(s) not counted yet (LAMP-1)");
    });

    it("can leave uncounted lines out", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(twoLines);
      await service.submit("c1", "skip", picker);
      expect(prisma.stockCountLine.updateMany).not.toHaveBeenCalled();
      expect(prisma.stockCount.update.mock.calls[0][0].data).toMatchObject({
        status: StockCountStatus.SUBMITTED,
        submittedById: "picker-lucy",
      });
    });

    it("can record uncounted lines as zero found", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(twoLines);
      await service.submit("c1", "zero", picker);
      expect(prisma.stockCountLine.updateMany).toHaveBeenCalledWith({
        where: { countId: "c1", countedQty: null },
        data: expect.objectContaining({ countedQty: 0 }),
      });
    });
  });

  describe("post", () => {
    const submitted = () =>
      count({
        status: StockCountStatus.SUBMITTED,
        notes: "Year end",
        lines: [
          line({ countedQty: 8 }), // 2 missing
          line({ id: "l2", productId: "p2", sku: "LAMP-1", productName: "Lamp", expectedQty: 3, countedQty: 4, unitCost: 800 }),
          line({ id: "l3", productId: "p3", sku: "RUG-1", expectedQty: 5, countedQty: 5 }), // no change
          line({ id: "l4", productId: "p4", sku: "VASE-1", expectedQty: 5, countedQty: null }), // skipped
        ],
      });

    beforeEach(() => {
      prisma.stockCount.findUnique.mockResolvedValue(submitted());
      prisma.stockCount.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...submitted(), ...data, postedAt: new Date("2026-10-10T10:00:00Z") }),
      );
      prisma.stockLevel.upsert.mockResolvedValue({ onHand: 6 });
    });

    it("applies each variance to current on-hand, with a transaction per line", async () => {
      await service.post("c1", manager);

      expect(prisma.stockLevel.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.stockLevel.upsert.mock.calls[0][0].update).toEqual({ onHand: { increment: -2 } });
      expect(prisma.stockLevel.upsert.mock.calls[1][0].update).toEqual({ onHand: { increment: 1 } });
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ quantityDelta: -2, referenceType: "STOCK_COUNT", referenceId: "SC-1001" }),
      });
      expect(prisma.stockCount.update.mock.calls[0][0].data).toMatchObject({
        status: StockCountStatus.POSTED,
        postedById: "mgr-sam",
      });
    });

    it("publishes StockAdjusted with only the changed lines, valued at their unit cost", async () => {
      await service.post("c1", manager);

      expect(eventBus.publish).toHaveBeenCalledWith(
        EventRoutingKey.STOCK_ADJUSTED,
        expect.objectContaining({
          kind: "STOCK_COUNT",
          reference: "SC-1001",
          locationCode: "WH-MAIN",
          adjustedById: "mgr-sam",
          description: "Stock count SC-1001 — Year end",
          lines: [
            { sku: "SOFA-1", productName: "Sofa", quantityDelta: -2, unitCost: 5000 },
            { sku: "LAMP-1", productName: "Lamp", quantityDelta: 1, unitCost: 800 },
          ],
        }),
      );
    });

    it("changes nothing and publishes nothing if on-hand would go negative", async () => {
      prisma.stockLevel.upsert.mockResolvedValueOnce({ onHand: -1 });
      await expect(service.post("c1", manager)).rejects.toThrow("recount it");
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("publishes nothing when every count matched", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(count({ status: StockCountStatus.SUBMITTED, lines: [line({ countedQty: 10 })] }));
      await service.post("c1", manager);
      expect(prisma.stockLevel.upsert).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("only posts a submitted count", async () => {
      prisma.stockCount.findUnique.mockResolvedValue(count());
      await expect(service.post("c1", manager)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it("cancels an open count but not a posted one", async () => {
    await service.cancel("c1", manager);
    expect(prisma.stockCount.update.mock.calls[0][0].data).toMatchObject({ status: StockCountStatus.CANCELLED });

    prisma.stockCount.findUnique.mockResolvedValue(count({ status: StockCountStatus.POSTED }));
    await expect(service.cancel("c1", manager)).rejects.toBeInstanceOf(ConflictException);
  });

  it("suggests never-counted products first, then the oldest count, then by value", async () => {
    const level = (productId: string, sku: string, onHand: number, unitCost: number) => ({
      productId,
      onHand,
      product: { sku, name: sku, unitCost },
    });
    prisma.stockLevel.findMany.mockResolvedValue([
      level("p1", "COUNTED-RECENTLY", 1, 100),
      level("p2", "NEVER-CHEAP", 1, 10),
      level("p3", "NEVER-PRICEY", 1, 1000),
      level("p4", "COUNTED-LONG-AGO", 1, 100),
    ]);
    prisma.stockCountLine.findMany.mockResolvedValue([
      { productId: "p1", count: { postedAt: new Date("2026-10-01") } },
      { productId: "p4", count: { postedAt: new Date("2026-01-01") } },
    ]);

    const rows = await service.suggestions("WH-MAIN", 10);

    expect(rows.map((r) => r.sku)).toEqual(["NEVER-PRICEY", "NEVER-CHEAP", "COUNTED-LONG-AGO", "COUNTED-RECENTLY"]);
    expect(rows[2].lastCountedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("summarize", () => {
  it("totals progress and variance value, ignoring uncounted lines", () => {
    expect(
      summarize([
        { expectedQty: 10, countedQty: 8, unitCost: 5000 },
        { expectedQty: 3, countedQty: 4, unitCost: "800.50" },
        { expectedQty: 5, countedQty: null, unitCost: 1 },
      ]),
    ).toEqual({
      lineCount: 3,
      countedLines: 2,
      linesWithVariance: 2,
      unitsOver: 1,
      unitsShort: 2,
      varianceValue: -9199.5,
    });
  });
});
