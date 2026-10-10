import type { NavSection } from "../components/AppShell";
import { BellAlertIcon, ChartBarIcon, ClipboardListIcon } from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Purchase orders", href: "/", icon: <ClipboardListIcon /> },
      { label: "Reorder suggestions", href: "/reorder-suggestions", icon: <BellAlertIcon /> },
      { label: "Supplier scorecard", href: "/reports", icon: <ChartBarIcon /> },
    ],
  },
];
