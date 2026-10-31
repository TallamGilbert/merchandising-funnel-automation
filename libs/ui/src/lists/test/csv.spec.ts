import { toCsv } from "../csv";

describe("toCsv", () => {
  const text = toCsv(
    [
      { header: "Name", value: (r: { name: string; n: number | null }) => r.name },
      { header: "Amount", value: (r) => r.n },
    ],
    [
      { name: "Plain", n: 1.5 },
      { name: 'Quote " and, comma', n: null },
      { name: "=SUM(A1)", n: -2 },
    ],
  );

  it("matches the API export format", () => {
    expect(text).toBe(String.fromCharCode(0xfeff) + 'Name,Amount\r\nPlain,1.5\r\n"Quote "" and, comma",\r\n\'=SUM(A1),-2\r\n');
  });
});
