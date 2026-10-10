import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  StreamableFile,
  UseInterceptors,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, Observable } from "rxjs";
import { toCsv } from "./csv";
import { ExportColumn } from "./export-columns";
import { ExportFormat, EXPORT_FORMATS } from "./list-query.dto";
import { toXlsx } from "./xlsx";

const EXPORT_KEY = "mms:export";

interface ExportSpec {
  /** File name without extension, e.g. "purchase-orders". */
  filename: string;
  columns: ExportColumn<never>[];
  rows?: (items: never[], result: never) => never[];
}

/**
 * Lets a list endpoint answer `?format=csv` or `?format=xlsx` with a file of
 * every matching row (see pageArgs: the service skips paging when `format`
 * is set). Without `format` the endpoint behaves exactly as before.
 */
export function Exportable<T, Item = T>(
  filename: string,
  columns: ExportColumn<T>[],
  /**
   * Turn the endpoint's items into export rows, e.g. one row per journal
   * line. Also gets the whole response, for reports that aren't a list.
   */
  rows?: (items: Item[], result: never) => T[],
) {
  return applyDecorators(
    SetMetadata(EXPORT_KEY, { filename, columns, rows } as unknown as ExportSpec),
    UseInterceptors(ExportInterceptor),
  );
}

@Injectable()
export class ExportInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ query: Record<string, unknown> }>();
    const format = request.query?.format;
    if (!isExportFormat(format)) return next.handle();

    const spec = this.reflector.get<ExportSpec>(EXPORT_KEY, context.getHandler());
    return next.handle().pipe(
      map((result: unknown) => {
        const items = (Array.isArray(result) ? result : ((result as { items?: unknown[] })?.items ?? [])) as never[];
        const rows = spec.rows ? spec.rows(items, result as never) : items;
        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `${spec.filename}-${stamp}.${format}`;
        const buffer = format === "csv" ? toCsv(spec.columns, rows) : toXlsx(spec.filename, spec.columns, rows);
        return new StreamableFile(buffer, {
          type:
            format === "csv"
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: `attachment; filename="${filename}"`,
          length: buffer.length,
        });
      }),
    );
  }
}

function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === "string" && (EXPORT_FORMATS as readonly string[]).includes(value);
}
