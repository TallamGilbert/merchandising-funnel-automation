import { generateTemporaryPassword, hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse");
    await expect(verifyPassword("correct horse", hash)).resolves.toBe(true);
    await expect(verifyPassword("correct hors", hash)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("stores the scheme and its parameters", async () => {
    expect(await hashPassword("x")).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(verifyPassword("x", "")).resolves.toBe(false);
    await expect(verifyPassword("x", "bcrypt$whatever")).resolves.toBe(false);
  });
});

describe("generateTemporaryPassword", () => {
  it("avoids characters that are easy to misread", () => {
    for (let i = 0; i < 50; i++) expect(generateTemporaryPassword()).toMatch(/^[^0O1lI]{10}$/);
  });
});
