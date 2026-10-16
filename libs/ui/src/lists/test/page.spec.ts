import { exportUrl, fetchAllPages, Page, withQuery } from "../page";

describe("withQuery", () => {
  it("adds non-empty params", () => {
    expect(withQuery("http://api/purchase-orders", { status: "DRAFT", q: "", page: 2, x: undefined })).toBe(
      "http://api/purchase-orders?status=DRAFT&page=2",
    );
  });

  it("appends to an existing query string and encodes values", () => {
    expect(withQuery("/x?a=1", { q: "chair & table" })).toBe("/x?a=1&q=chair+%26+table");
  });

  it("leaves the url alone with nothing to add", () => {
    expect(withQuery("/x", {})).toBe("/x");
  });
});

describe("exportUrl", () => {
  it("keeps filters and search, drops paging, adds the format", () => {
    expect(exportUrl("/payables", { page: 3, pageSize: 20, status: "OPEN", q: "acme" }, "xlsx")).toBe(
      "/payables?status=OPEN&q=acme&format=xlsx",
    );
  });
});

describe("fetchAllPages", () => {
  const rows = Array.from({ length: 230 }, (_, i) => i);
  const fetchPage = jest.fn(
    async (page: number, pageSize: number): Promise<Page<number>> => ({
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    }),
  );

  it("collects every page", async () => {
    await expect(fetchAllPages(fetchPage)).resolves.toEqual(rows);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("refuses an unreasonably large set instead of returning part of it", async () => {
    const huge = async (): Promise<Page<number>> => ({ items: [], total: 1_000_000, page: 1, pageSize: 100 });
    await expect(fetchAllPages(huge)).rejects.toThrow(/Too many rows/);
  });
});
