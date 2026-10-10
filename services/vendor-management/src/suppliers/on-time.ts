/**
 * D-20 — delivery reliability per supplier from recorded deliveries. Pure,
 * unit-tested.
 */
export interface DeliveryForPerformance {
  supplierId: string;
  supplierName: string;
  expectedDate: Date;
  actualDeliveryDate: Date;
  onTime: boolean;
}

export interface OnTimeRow {
  supplierId: string;
  supplierName: string;
  deliveries: number;
  onTime: number;
  late: number;
  /** 0–1. */
  onTimeRate: number;
  /** Average days late across late deliveries; null if none were late. */
  averageDaysLate: number | null;
}

const DAY_MS = 86_400_000;

export function onTimePerformance(deliveries: DeliveryForPerformance[]): OnTimeRow[] {
  const rows = new Map<string, OnTimeRow & { daysLate: number }>();
  for (const d of deliveries) {
    const row = rows.get(d.supplierId) ?? {
      supplierId: d.supplierId,
      supplierName: d.supplierName,
      deliveries: 0,
      onTime: 0,
      late: 0,
      onTimeRate: 0,
      averageDaysLate: null,
      daysLate: 0,
    };
    row.deliveries++;
    if (d.onTime) {
      row.onTime++;
    } else {
      row.late++;
      row.daysLate += Math.max(0, Math.round((d.actualDeliveryDate.getTime() - d.expectedDate.getTime()) / DAY_MS));
    }
    rows.set(d.supplierId, row);
  }
  return [...rows.values()]
    .map(({ daysLate, ...row }) => ({
      ...row,
      onTimeRate: Math.round((row.onTime / row.deliveries) * 1000) / 1000,
      averageDaysLate: row.late ? Math.round((daysLate / row.late) * 10) / 10 : null,
    }))
    .sort((a, b) => a.onTimeRate - b.onTimeRate || b.deliveries - a.deliveries);
}
