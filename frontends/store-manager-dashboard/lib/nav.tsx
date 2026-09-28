import type { NavSection } from "../components/AppShell";
import { ClipboardCheckIcon, StoreIcon, UsersIcon } from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Overview", href: "/", icon: <StoreIcon /> },
      { label: "Close register", href: "/close", icon: <ClipboardCheckIcon /> },
      { label: "Staff", href: "/staff", icon: <UsersIcon /> },
    ],
  },
];
