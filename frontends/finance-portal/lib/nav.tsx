import type { NavSection } from "../components/AppShell";
import { AlertIcon, BookIcon, ChartIcon, ReceiptIcon, TrendIcon } from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Overview", href: "/", icon: <ChartIcon /> },
      { label: "Profitability", href: "/profitability", icon: <TrendIcon /> },
      { label: "Accounts payable", href: "/payables", icon: <ReceiptIcon /> },
      { label: "General ledger", href: "/ledger", icon: <BookIcon /> },
      { label: "Posting issues", href: "/events", icon: <AlertIcon /> },
    ],
  },
];

export const STATUS_CARD = {
  title: "Phase 4 — Accounting",
  description: "Ledger postings from goods received, sales, returns and day closes (FR-8.x).",
  href: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3008") + "/docs",
  linkLabel: "View API docs ↗",
};
