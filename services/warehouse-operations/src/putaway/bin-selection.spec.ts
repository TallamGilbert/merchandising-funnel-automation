import { BinCandidate, footprintFor, selectBin } from "./bin-selection";

const bin = (overrides: Partial<BinCandidate> & { code: string }): BinCandidate => ({
  id: overrides.code,
  pickPriority: 100,
  capacityVolumeCm3: 1_000_000,
  maxWeightKg: 500,
  usedVolumeCm3: 0,
  usedWeightKg: 0,
  ...overrides,
});

describe("footprintFor", () => {
  it("multiplies unit volume and weight by quantity", () => {
    expect(
      footprintFor({ lengthCm: 50, widthCm: 40, heightCm: 90, weightKg: 8 }, 3),
    ).toEqual({ volumeCm3: 540_000, weightKg: 24 });
  });

  it("treats unknown dimensions as zero volume", () => {
    expect(
      footprintFor({ lengthCm: null, widthCm: 40, heightCm: 90, weightKg: null }, 3),
    ).toEqual({ volumeCm3: 0, weightKg: 0 });
  });
});

describe("selectBin", () => {
  const footprint = { volumeCm3: 100_000, weightKg: 50 };

  it("sends fast movers to the bin nearest dispatch", () => {
    const bins = [bin({ code: "B", pickPriority: 50 }), bin({ code: "A", pickPriority: 10 })];
    expect(selectBin(bins, footprint, true)?.code).toBe("A");
  });

  it("keeps slow movers away from the prime slots", () => {
    const bins = [bin({ code: "A", pickPriority: 10 }), bin({ code: "B", pickPriority: 50 })];
    expect(selectBin(bins, footprint, false)?.code).toBe("B");
  });

  it("skips bins without enough free volume", () => {
    const bins = [
      bin({ code: "A", pickPriority: 10, usedVolumeCm3: 950_000 }),
      bin({ code: "B", pickPriority: 50 }),
    ];
    expect(selectBin(bins, footprint, true)?.code).toBe("B");
  });

  it("skips bins without enough weight allowance", () => {
    const bins = [
      bin({ code: "A", pickPriority: 10, usedWeightKg: 480 }),
      bin({ code: "B", pickPriority: 50 }),
    ];
    expect(selectBin(bins, footprint, true)?.code).toBe("B");
  });

  it("returns undefined when nothing fits", () => {
    expect(selectBin([bin({ code: "A", capacityVolumeCm3: 10 })], footprint, true)).toBeUndefined();
  });
});
