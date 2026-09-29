/** Money is summed in integer cents so rounding never unbalances an entry. */
export function toCents(value: number | string | { toString(): string }): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumMoney(values: (number | string | { toString(): string })[]): number {
  return fromCents(values.reduce<number>((sum, v) => sum + toCents(v), 0));
}
