import { CallHandler, ExecutionContext, StreamableFile } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { lastValueFrom, of } from "rxjs";
import { Exportable, ExportInterceptor } from "../exportable";
import { EXPORT_MAX_ROWS, ListQueryDto } from "../list-query.dto";
import { dateRange, pageArgs, paged, searchAny } from "../paging";

describe("ListQueryDto", () => {
  const parse = (query: Record<string, string>) => {
    const dto = plainToInstance(ListQueryDto, query);
    return { dto, errors: validateSync(dto) };
  };

  it("defaults to the first page of 20", () => {
    const { dto, errors } = parse({});
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ page: 1, pageSize: 20 });
  });

  it("parses numbers from the query string and trims the search", () => {
    const { dto } = parse({ page: "3", pageSize: "50", q: "  chair " });
    expect(dto).toMatchObject({ page: 3, pageSize: 50, q: "chair" });
  });

  it("treats a blank search as none", () => {
    expect(parse({ q: "   " }).dto.q).toBeUndefined();
  });

  it.each<Record<string, string>>([{ pageSize: "101" }, { page: "0" }, { format: "pdf" }])("rejects %p", (query) => {
    expect(parse(query).errors).not.toEqual([]);
  });
});

describe("paging helpers", () => {
  it("turns a page into skip/take", () => {
    expect(pageArgs({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it("returns the whole (capped) result for an export", () => {
    expect(pageArgs({ page: 3, pageSize: 20, format: "csv" })).toEqual({ skip: 0, take: EXPORT_MAX_ROWS });
  });

  it("wraps items in the page envelope", () => {
    expect(paged(["a"], 41, { page: 3, pageSize: 20 })).toEqual({ items: ["a"], total: 41, page: 3, pageSize: 20 });
  });

  it("builds a case-insensitive OR search", () => {
    expect(searchAny("po-1", ["poNumber", "supplierName"])).toEqual({
      OR: [
        { poNumber: { contains: "po-1", mode: "insensitive" } },
        { supplierName: { contains: "po-1", mode: "insensitive" } },
      ],
    });
    expect(searchAny(undefined, ["poNumber"])).toBeUndefined();
  });

  it("makes an inclusive day range", () => {
    expect(dateRange("2026-10-01", "2026-10-02")).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-10-03T00:00:00.000Z"),
    });
    expect(dateRange()).toBeUndefined();
  });
});

describe("ExportInterceptor", () => {
  class Controller {
    @Exportable<{ sku: string; qty: number }>("stock", [
      { header: "SKU", value: (r) => r.sku },
      { header: "Qty", value: (r) => r.qty },
    ])
    list() {}
  }

  const interceptor = new ExportInterceptor(new Reflector());
  const page = { items: [{ sku: "CHAIR-1", qty: 4 }], total: 1, page: 1, pageSize: 20 };
  const run = (query: Record<string, string>) => {
    const ctx = {
      getHandler: () => Controller.prototype.list,
      switchToHttp: () => ({ getRequest: () => ({ query }) }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of(page) };
    return lastValueFrom(interceptor.intercept(ctx, next));
  };

  it("passes the page through without a format", async () => {
    await expect(run({})).resolves.toBe(page);
  });

  it("turns the rows into a CSV download", async () => {
    const file = (await run({ format: "csv" })) as StreamableFile;
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders().type).toBe("text/csv; charset=utf-8");
    expect(file.getHeaders().disposition).toMatch(/^attachment; filename="stock-\d{4}-\d{2}-\d{2}\.csv"$/);
  });

  it("turns the rows into an xlsx download", async () => {
    const file = (await run({ format: "xlsx" })) as StreamableFile;
    expect(file.getHeaders().type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("can flatten items into several rows each", async () => {
    class Flattening {
      @Exportable<{ line: string }, { lines: string[] }>(
        "entries",
        [{ header: "Line", value: (r) => r.line }],
        (items) => items.flatMap((i) => i.lines.map((line) => ({ line }))),
      )
      list() {}
    }
    const ctx = {
      getHandler: () => Flattening.prototype.list,
      switchToHttp: () => ({ getRequest: () => ({ query: { format: "csv" } }) }),
    } as unknown as ExecutionContext;
    const file = (await lastValueFrom(
      interceptor.intercept(ctx, { handle: () => of({ items: [{ lines: ["a", "b"] }, { lines: ["c"] }] }) }),
    )) as StreamableFile;
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString("utf8")).toBe("\uFEFFLine\r\na\r\nb\r\nc\r\n");
  });

  it("ignores an unknown format (validation rejects it before the handler)", async () => {
    await expect(run({ format: "pdf" })).resolves.toBe(page);
  });
});
