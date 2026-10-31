export type ExportValue = string | number | Date | null | undefined;

/** One column of an export: its header and how to read it from a row. */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => ExportValue;
}
