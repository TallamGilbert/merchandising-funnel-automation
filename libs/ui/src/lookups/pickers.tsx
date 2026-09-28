"use client";

import { useEffect, useState } from "react";
import { Combobox, ComboboxOption } from "../components/Combobox";
import { formatDate } from "../format/format";
import { CatalogProduct, lookupApi, PurchaseOrderStatus, PurchaseOrderSummary } from "./client";

interface PickerProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  clearOnSelect?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
}

function useRemote<T>(load: () => Promise<T[]>, key: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((rows) => {
        if (cancelled) return;
        setData(rows);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `key` stands in for `load`, which is a fresh closure every render.
  }, [key]);

  return { data, loading, error };
}

/** Pick a product from Inventory's catalog by name or SKU; the form receives the SKU. */
export function ProductPicker({
  onSelectProduct,
  excludeSkus,
  ...props
}: PickerProps & {
  onSelectProduct?: (product: CatalogProduct | null) => void;
  /** e.g. SKUs this supplier already offers. */
  excludeSkus?: string[];
}) {
  const { data: products, loading, error } = useRemote(lookupApi.listCatalogProducts, "catalog");
  const excluded = new Set(excludeSkus ?? []);
  const options: ComboboxOption[] = products
    .filter((p) => !excluded.has(p.sku))
    .map((p) => ({ value: p.sku, label: p.name, description: p.sku }));

  return (
    <>
      <Combobox
        {...props}
        options={options}
        loading={loading}
        placeholder={props.placeholder ?? "Search products by name or SKU…"}
        emptyMessage="No matching products"
        onChange={(value) => {
          props.onChange(value);
          onSelectProduct?.(products.find((p) => p.sku === value) ?? null);
        }}
      />
      {error && <span className="mms-field-error">Product catalog unavailable: {error}</span>}
    </>
  );
}

/** Pick a purchase order by number or supplier; the form receives the PO number. */
export function PurchaseOrderPicker({
  supplierId,
  statuses,
  onSelectOrder,
  ...props
}: PickerProps & {
  supplierId?: string;
  statuses?: PurchaseOrderStatus[];
  onSelectOrder?: (order: PurchaseOrderSummary | null) => void;
}) {
  const { data: orders, loading, error } = useRemote(lookupApi.listPurchaseOrders, "purchase-orders");
  const visible = orders.filter(
    (o) => (!supplierId || o.supplierId === supplierId) && (!statuses || statuses.includes(o.status)),
  );
  const options: ComboboxOption[] = visible.map((o) => ({
    value: o.poNumber,
    label: o.poNumber,
    description: `${o.supplierName} · ${o.status.replace(/_/g, " ").toLowerCase()} · ${formatDate(o.createdAt)}`,
  }));

  return (
    <>
      <Combobox
        {...props}
        options={options}
        loading={loading}
        placeholder={props.placeholder ?? "Search purchase orders…"}
        emptyMessage="No matching purchase orders"
        onChange={(value) => {
          props.onChange(value);
          onSelectOrder?.(visible.find((o) => o.poNumber === value) ?? null);
        }}
      />
      {error && <span className="mms-field-error">Purchase orders unavailable: {error}</span>}
    </>
  );
}
