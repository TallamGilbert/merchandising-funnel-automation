import type { NavSection } from "../components/AppShell";
import { ArrowUturnLeftIcon, CartIcon, TagIcon } from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Checkout", href: "/", icon: <CartIcon /> },
      { label: "Returns", href: "/returns", icon: <ArrowUturnLeftIcon /> },
      { label: "Price list", href: "/prices", icon: <TagIcon /> },
    ],
  },
];
