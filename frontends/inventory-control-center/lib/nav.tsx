import type { NavSection } from "../components/AppShell";
import { BoxesIcon, ClipboardListIcon, LayersIcon } from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Products", href: "/", icon: <BoxesIcon /> },
      { label: "Stock levels", href: "/stock-levels", icon: <LayersIcon /> },
      { label: "Stock counts", href: "/stock-counts", icon: <ClipboardListIcon /> },
    ],
  },
];
