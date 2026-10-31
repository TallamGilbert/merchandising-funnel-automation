import type { Register } from "./client";

/** Directory's rule for location and register codes (CreateLocationDto / CreateRegisterDto). */
export const DIRECTORY_CODE_PATTERN = /^[A-Z0-9-]+$/;

/** Uppercases as people type and turns spaces into dashes, so "store 3" becomes "STORE-3". */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/\s+/g, "-");
}

/** Null when the code is acceptable, otherwise why not. */
export function codeError(code: string): string | null {
  if (!code) return "Enter a code";
  if (!DIRECTORY_CODE_PATTERN.test(code)) return "Use uppercase letters, digits and dashes only";
  return null;
}

/** The next free REG-n in a store, e.g. REG-3 after REG-1 and REG-2. */
export function nextRegisterCode(registers: Pick<Register, "code">[]): string {
  const taken = new Set(registers.map((r) => r.code));
  let n = 1;
  while (taken.has(`REG-${n}`)) n++;
  return `REG-${n}`;
}
