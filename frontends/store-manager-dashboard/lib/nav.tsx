import type { NavSection } from "../components/AppShell";
import { ChartBarIcon, ClipboardCheckIcon, MapPinIcon, StoreIcon, UsersIcon } from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Overview", href: "/", icon: <StoreIcon /> },
      { label: "Close register", href: "/close", icon: <ClipboardCheckIcon /> },
      { label: "Reports", href: "/reports", icon: <ChartBarIcon /> },
      { label: "Staff", href: "/staff", icon: <UsersIcon /> },
      { label: "Stores", href: "/stores", icon: <MapPinIcon /> },
    ],
  },
];
