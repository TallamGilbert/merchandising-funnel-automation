import { codeError, nextRegisterCode, normalizeCode } from "../codes";

describe("normalizeCode", () => {
  it("uppercases and turns spaces into dashes", () => {
    expect(normalizeCode("store 3")).toBe("STORE-3");
    expect(normalizeCode("wh-east")).toBe("WH-EAST");
  });
});

describe("codeError", () => {
  it("accepts uppercase letters, digits and dashes", () => {
    expect(codeError("STORE-3")).toBeNull();
    expect(codeError("WH-MAIN")).toBeNull();
    expect(codeError("REG-10")).toBeNull();
  });

  it("rejects an empty code", () => {
    expect(codeError("")).toBe("Enter a code");
  });

  it("rejects anything the Directory API would", () => {
    for (const code of ["store-3", "STORE_3", "STORE 3", "STORÉ", "STORE/3"]) {
      expect(codeError(code)).toBe("Use uppercase letters, digits and dashes only");
    }
  });
});

describe("nextRegisterCode", () => {
  it("starts at REG-1", () => {
    expect(nextRegisterCode([])).toBe("REG-1");
  });

  it("takes the first free number", () => {
    expect(nextRegisterCode([{ code: "REG-1" }, { code: "REG-2" }])).toBe("REG-3");
    expect(nextRegisterCode([{ code: "REG-2" }, { code: "TILL-A" }])).toBe("REG-1");
  });
});
