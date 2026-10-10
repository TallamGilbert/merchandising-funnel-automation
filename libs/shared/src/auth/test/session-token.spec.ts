import { Role, SERVICE_ROLE } from "../roles";
import { AuthUser, serviceToken, signSessionToken, verifySessionToken } from "../session-token";

const USER: AuthUser = {
  id: "mgr-sam",
  name: "Sam Otieno",
  role: Role.MANAGER,
  locationCode: "WH-MAIN",
  mustChangePassword: false,
  sessionVersion: 3,
};

describe("session tokens", () => {
  const originalSecret = process.env.AUTH_JWT_SECRET;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.AUTH_JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalEnv;
    if (originalSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  });

  it("round-trips the user", () => {
    expect(verifySessionToken(signSessionToken(USER))).toEqual(USER);
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const token = signSessionToken(USER, 60, now);
    expect(verifySessionToken(token, now + 59_000)).not.toBeNull();
    expect(verifySessionToken(token, now + 60_000)).toBeNull();
  });

  it("rejects a token whose claims were edited", () => {
    const [header, , signature] = signSessionToken(USER).split(".");
    const forged = Buffer.from(JSON.stringify({ ...USER, role: Role.OWNER, exp: 9e9 })).toString("base64url");
    expect(verifySessionToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    process.env.AUTH_JWT_SECRET = "a".repeat(32);
    const token = signSessionToken(USER);
    process.env.AUTH_JWT_SECRET = "b".repeat(32);
    expect(verifySessionToken(token)).toBeNull();
  });

  it('rejects alg "none" and other headers', () => {
    const [, payload] = signSessionToken(USER).split(".");
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(verifySessionToken(`${none}.${payload}.`)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifySessionToken("not-a-token")).toBeNull();
    expect(verifySessionToken("a.b.c")).toBeNull();
  });

  it("refuses to sign in production without a real secret", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_JWT_SECRET;
    expect(() => signSessionToken(USER)).toThrow(/AUTH_JWT_SECRET/);
    process.env.AUTH_JWT_SECRET = "too-short";
    expect(() => signSessionToken(USER)).toThrow(/AUTH_JWT_SECRET/);
  });

  it("mints a SERVICE token and reuses it until close to expiry", () => {
    const now = Date.now() + 10 * 60_000; // past any token cached by another test
    const first = serviceToken(now);
    expect(verifySessionToken(first, now)?.role).toBe(SERVICE_ROLE);
    expect(serviceToken(now + 60_000)).toBe(first);
    expect(serviceToken(now + 4.5 * 60_000)).not.toBe(first);
  });
});
