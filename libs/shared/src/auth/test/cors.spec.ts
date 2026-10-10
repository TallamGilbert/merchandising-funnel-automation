import { corsOptions, originPattern } from "../cors";

function allowed(origin: string | undefined): boolean {
  let result = false;
  corsOptions().origin(origin, (_err, allow) => (result = Boolean(allow)));
  return result;
}

describe("originPattern", () => {
  it("matches one subdomain label", () => {
    const re = originPattern("https://*.example.com");
    expect(re.test("https://finance.example.com")).toBe(true);
    expect(re.test("https://finance-api.example.com")).toBe(true);
    expect(re.test("https://example.com")).toBe(false);
    expect(re.test("https://a.b.example.com")).toBe(false);
    expect(re.test("https://evil.example.com.attacker.io")).toBe(false);
    expect(re.test("http://finance.example.com")).toBe(false);
  });

  it("matches any port", () => {
    const re = originPattern("http://localhost:*");
    expect(re.test("http://localhost:3102")).toBe(true);
    expect(re.test("http://localhost")).toBe(false);
  });

  it("treats dots literally", () => {
    expect(originPattern("https://app.example.com").test("https://appxexample.com")).toBe(false);
  });
});

describe("corsOptions", () => {
  const original = process.env.CORS_ORIGINS;
  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = original;
  });

  it("allows localhost by default", () => {
    delete process.env.CORS_ORIGINS;
    expect(allowed("http://localhost:3108")).toBe(true);
    expect(allowed("https://evil.io")).toBe(false);
  });

  it("reads a comma-separated list", () => {
    process.env.CORS_ORIGINS = "https://*.example.com, https://other.io";
    expect(allowed("https://pos.example.com")).toBe(true);
    expect(allowed("https://other.io")).toBe(true);
    expect(allowed("http://localhost:3108")).toBe(false);
  });

  it("allows requests without an Origin header", () => {
    expect(allowed(undefined)).toBe(true);
  });

  it("sends credentials", () => {
    expect(corsOptions().credentials).toBe(true);
  });
});
