import type { NavSection } from "../components/AppShell";
import { BoxesIcon, ChartBarIcon, ClipboardListIcon, LayersIcon } from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Products", href: "/", icon: <BoxesIcon /> },
      { label: "Stock levels", href: "/stock-levels", icon: <LayersIcon /> },
      { label: "Stock counts", href: "/stock-counts", icon: <ClipboardListIcon /> },
      {
        label: "Slow & dead stock",
        href: "/reports",
        icon: <ChartBarIcon />,
        roles: ["OWNER", "MANAGER", "BUYER", "ACCOUNTANT"],
      },
    ],
  },
];
