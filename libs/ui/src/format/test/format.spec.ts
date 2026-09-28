import { isSupportedCurrency } from "../currency";
import {
  formatAmount,
  formatCompact,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatSignedMoney,
} from "../format";

describe("formatAmount", () => {
  it("adds thousands separators and two decimals", () => {
    expect(formatAmount(2999.99)).toBe("2,999.99");
    expect(formatAmount(1234567.5)).toBe("1,234,567.50");
    expect(formatAmount(0)).toBe("0.00");
  });

  it("accepts Decimal-as-string values from the API", () => {
    expect(formatAmount("2999.99")).toBe("2,999.99");
  });

  it("shows a dash for missing or unparseable values", () => {
    expect(formatAmount(null)).toBe("—");
    expect(formatAmount(undefined)).toBe("—");
    expect(formatAmount("")).toBe("—");
    expect(formatAmount("abc")).toBe("—");
  });
});

describe("formatMoney", () => {
  it("prefixes the currency label, KES by default", () => {
    expect(formatMoney(2999.99)).toBe("KES 2,999.99");
    expect(formatMoney("150000", "USD")).toBe("USD 150,000.00");
  });

  it("puts the sign before the currency label", () => {
    expect(formatMoney(-50)).toBe("-KES 50.00");
  });
});

describe("formatSignedMoney", () => {
  it("marks overages with + and shortages with -", () => {
    expect(formatSignedMoney(50)).toBe("+KES 50.00");
    expect(formatSignedMoney(-50)).toBe("-KES 50.00");
    expect(formatSignedMoney(0)).toBe("KES 0.00");
  });
});

describe("formatQuantity", () => {
  it("groups thousands without decimals", () => {
    expect(formatQuantity(12500)).toBe("12,500");
  });
});

describe("formatDate", () => {
  it("writes the month out in full, day first", () => {
    expect(formatDate("2026-09-25T13:19:00Z", { timeZone: "Africa/Nairobi" })).toBe("25 September 2026");
  });

  it("never shifts a bare business date onto a neighbouring day", () => {
    expect(formatDate("2026-09-25", { timeZone: "Pacific/Honolulu" })).toBe("25 September 2026");
    expect(formatDate("2026-09-25", { timeZone: "Pacific/Kiritimati" })).toBe("25 September 2026");
  });

  it("shows a dash for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("renders the date then a 12-hour time", () => {
    // 13:19 UTC is 16:19 in Nairobi (UTC+3).
    expect(formatDateTime("2026-09-25T13:19:00Z", { timeZone: "Africa/Nairobi" })).toBe(
      "25 September 2026 at 4:19 PM",
    );
  });

  it("handles morning times", () => {
    expect(formatDateTime("2026-09-25T06:05:00Z", { timeZone: "Africa/Nairobi" })).toBe(
      "25 September 2026 at 9:05 AM",
    );
  });

  it("uses the viewer's date across a day boundary", () => {
    expect(formatDateTime("2026-09-25T22:30:00Z", { timeZone: "Africa/Nairobi" })).toBe(
      "26 September 2026 at 1:30 AM",
    );
  });
});

describe("isSupportedCurrency", () => {
  it("accepts only the listed codes", () => {
    expect(isSupportedCurrency("KES")).toBe(true);
    expect(isSupportedCurrency("kes")).toBe(false);
    expect(isSupportedCurrency("KES 100")).toBe(false);
  });
});

describe("formatCompact", () => {
  it("abbreviates thousands and millions for axis ticks", () => {
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(12500)).toBe("12.5K");
    expect(formatCompact(2000000)).toBe("2M");
  });
});
