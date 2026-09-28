import { DEMO_DIRECTORY } from "../demo-directory";
import { SeedRepository } from "../seed.repository";
import { SeedService } from "../seed.service";

describe("SeedService", () => {
  let service: SeedService;
  let seed: { isEmpty: jest.Mock; insert: jest.Mock };
  const original = process.env.DIRECTORY_SEED_DEMO;

  beforeEach(() => {
    delete process.env.DIRECTORY_SEED_DEMO;
    seed = { isEmpty: jest.fn().mockResolvedValue(true), insert: jest.fn().mockResolvedValue(undefined) };
    service = new SeedService(seed as unknown as SeedRepository);
  });

  afterAll(() => {
    if (original === undefined) delete process.env.DIRECTORY_SEED_DEMO;
    else process.env.DIRECTORY_SEED_DEMO = original;
  });

  it("seeds the demo directory into an empty database by default", async () => {
    await expect(service.seedDemoIfEmpty()).resolves.toBe(true);
    expect(seed.insert).toHaveBeenCalledWith(DEMO_DIRECTORY);
  });

  it("never touches a directory that already has data", async () => {
    seed.isEmpty.mockResolvedValue(false);

    await expect(service.seedDemoIfEmpty()).resolves.toBe(false);
    expect(seed.insert).not.toHaveBeenCalled();
  });

  it("does nothing when DIRECTORY_SEED_DEMO=false", async () => {
    process.env.DIRECTORY_SEED_DEMO = "false";

    await expect(service.seedDemoIfEmpty()).resolves.toBe(false);
    expect(seed.isEmpty).not.toHaveBeenCalled();
  });

  it("only references locations the demo data defines", () => {
    const codes = new Set(DEMO_DIRECTORY.locations.map((l) => l.code));

    for (const register of DEMO_DIRECTORY.registers) expect(codes).toContain(register.locationCode);
    for (const person of DEMO_DIRECTORY.staff) {
      if (person.locationCode) expect(codes).toContain(person.locationCode);
    }
  });
});
