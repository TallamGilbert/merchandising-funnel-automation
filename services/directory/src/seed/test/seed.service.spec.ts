import { verifyPassword } from "../../auth/password";
import { DEMO_DIRECTORY } from "../demo-directory";
import { SeedRepository } from "../seed.repository";
import { SeedService } from "../seed.service";

describe("SeedService", () => {
  let service: SeedService;
  let seed: Record<"isEmpty" | "insert" | "setPasswordWhereUnset" | "ownerCanSignIn" | "upsertOwner", jest.Mock>;
  const ENV_VARS = [
    "DIRECTORY_SEED_DEMO",
    "DEMO_STAFF_PASSWORD",
    "BOOTSTRAP_OWNER_ID",
    "BOOTSTRAP_OWNER_PASSWORD",
    "BOOTSTRAP_OWNER_NAME",
  ];
  const original = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]]));

  beforeEach(() => {
    for (const k of ENV_VARS) delete process.env[k];
    seed = {
      isEmpty: jest.fn().mockResolvedValue(true),
      insert: jest.fn().mockResolvedValue(undefined),
      setPasswordWhereUnset: jest.fn().mockResolvedValue(3),
      ownerCanSignIn: jest.fn().mockResolvedValue(false),
      upsertOwner: jest.fn().mockResolvedValue({}),
    };
    service = new SeedService(seed as unknown as SeedRepository);
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
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

  describe("demo passwords", () => {
    it("are only set when DEMO_STAFF_PASSWORD is", async () => {
      await expect(service.setDemoPasswords()).resolves.toBe(0);
      expect(seed.setPasswordWhereUnset).not.toHaveBeenCalled();
    });

    it("go to every demo staff member who has none yet", async () => {
      process.env.DEMO_STAFF_PASSWORD = "demo-pass";

      await service.setDemoPasswords();

      const [ids, hash] = seed.setPasswordWhereUnset.mock.calls[0];
      expect(ids).toEqual(DEMO_DIRECTORY.staff.map((s) => s.id));
      await expect(verifyPassword("demo-pass", hash)).resolves.toBe(true);
    });

    it("are never set when demo seeding is off", async () => {
      process.env.DEMO_STAFF_PASSWORD = "demo-pass";
      process.env.DIRECTORY_SEED_DEMO = "false";
      await expect(service.setDemoPasswords()).resolves.toBe(0);
    });
  });

  describe("bootstrapOwner", () => {
    beforeEach(() => {
      process.env.BOOTSTRAP_OWNER_ID = " Owner-Main ";
      process.env.BOOTSTRAP_OWNER_PASSWORD = "first-sign-in";
    });

    it("creates the owner when nobody can sign in as one", async () => {
      await expect(service.bootstrapOwner()).resolves.toBe(true);

      const [id, name, hash] = seed.upsertOwner.mock.calls[0];
      expect(id).toBe("owner-main");
      expect(name).toBe("Owner");
      await expect(verifyPassword("first-sign-in", hash)).resolves.toBe(true);
    });

    it("does nothing once an owner can sign in", async () => {
      seed.ownerCanSignIn.mockResolvedValue(true);
      await expect(service.bootstrapOwner()).resolves.toBe(false);
      expect(seed.upsertOwner).not.toHaveBeenCalled();
    });

    it("does nothing without both variables", async () => {
      delete process.env.BOOTSTRAP_OWNER_PASSWORD;
      await expect(service.bootstrapOwner()).resolves.toBe(false);
    });

    it("refuses a too-short password", async () => {
      process.env.BOOTSTRAP_OWNER_PASSWORD = "short";
      await expect(service.bootstrapOwner()).resolves.toBe(false);
      expect(seed.upsertOwner).not.toHaveBeenCalled();
    });
  });
});
