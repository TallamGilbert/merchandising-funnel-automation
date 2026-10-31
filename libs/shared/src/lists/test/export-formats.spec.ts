import { crc32, inflateRawSync } from "zlib";
import { toCsv } from "../csv";
import { ExportColumn } from "../export-columns";
import { columnName, toXlsx } from "../xlsx";

interface Row {
  name: string;
  amount: number;
  when: Date | null;
}

const COLUMNS: ExportColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Amount (KES)", value: (r) => r.amount },
  { header: "When", value: (r) => r.when },
];

const ROWS: Row[] = [
  { name: "Wanjiku & Sons", amount: 1500.5, when: new Date("2026-10-01T08:00:00.000Z") },
  { name: 'Say "hi", then\nleave', amount: -20, when: null },
  { name: "=HYPERLINK(\"http://evil\")", amount: 0, when: null },
];

describe("toCsv", () => {
  const text = toCsv(COLUMNS, ROWS).toString("utf8");

  it("starts with a byte-order mark so Excel reads UTF-8", () => {
    expect(text.charCodeAt(0)).toBe(0xfeff);
  });

  it("writes a header row and CRLF line ends", () => {
    expect(text.slice(1).split("\r\n")[0]).toBe("Name,Amount (KES),When");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(text).toContain('"Say ""hi"", then\nleave",-20,');
  });

  it("keeps numbers and ISO dates, leaves empties empty", () => {
    expect(text).toContain("Wanjiku & Sons,1500.5,2026-10-01T08:00:00.000Z\r\n");
  });

  it("defuses text that would run as a formula", () => {
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")",0,`);
  });
});

/** Just enough unzip to read the package back: central directory → inflate. */
function unzip(buffer: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(endOffset + 10);
  let p = buffer.readUInt32LE(endOffset + 16);
  for (let i = 0; i < count; i++) {
    expect(buffer.readUInt32LE(p)).toBe(0x02014b50);
    const crc = buffer.readUInt32LE(p + 16);
    const compressed = buffer.readUInt32LE(p + 20);
    const nameLength = buffer.readUInt16LE(p + 28);
    const local = buffer.readUInt32LE(p + 42);
    const name = buffer.toString("utf8", p + 46, p + 46 + nameLength);
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26);
    const raw = inflateRawSync(buffer.subarray(dataStart, dataStart + compressed));
    expect(crc32(raw)).toBe(crc);
    files.set(name, raw.toString("utf8"));
    p += 46 + nameLength;
  }
  return files;
}

describe("toXlsx", () => {
  const files = unzip(toXlsx("purchase-orders", COLUMNS, ROWS));
  const sheet = files.get("xl/worksheets/sheet1.xml") ?? "";

  it("is a zip with the parts Excel needs, CRCs intact", () => {
    expect([...files.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("names the sheet", () => {
    expect(files.get("xl/workbook.xml")).toContain('<sheet name="purchase-orders"');
  });

  it("writes numbers as numbers and text as escaped inline strings", () => {
    expect(sheet).toContain('<c r="B2"><v>1500.5</v></c>');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Wanjiku &amp; Sons</t></is></c>');
    expect(sheet).toContain("Say &quot;hi&quot;, then\nleave");
  });

  it("skips empty cells and freezes the header row", () => {
    expect(sheet).not.toContain('r="C3"');
    expect(sheet).toContain('state="frozen"');
  });

  it("drops characters XML can't hold instead of writing a broken file", () => {
    const columns: ExportColumn<{ a: string }>[] = [{ header: "A", value: (r) => r.a }];
    const xml = unzip(toXlsx("x", columns, [{ a: `bell${String.fromCharCode(7)}here` }])).get("xl/worksheets/sheet1.xml");
    expect(xml).toContain(">bellhere<");
  });

  it("produces identical bytes for identical input", () => {
    expect(toXlsx("x", COLUMNS, ROWS).equals(toXlsx("x", COLUMNS, ROWS))).toBe(true);
  });
});

describe("columnName", () => {
  it.each([
    [0, "A"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [701, "ZZ"],
    [702, "AAA"],
  ])("%i → %s", (index, name) => {
    expect(columnName(index)).toBe(name);
  });
});
