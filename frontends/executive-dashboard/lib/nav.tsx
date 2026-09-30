import type { NavSection } from "../components/AppShell";
import {
  BookIcon,
  BoxesIcon,
  CartIcon,
  ChartIcon,
  ClipboardIcon,
  HandshakeIcon,
  StoreIcon,
  TruckIcon,
} from "../components/icons";

export const NAV: NavSection[] = [
  {
    label: "Business",
    items: [{ label: "Overview", href: "/", icon: <ChartIcon /> }],
  },
  {
    label: "Areas",
    items: [
      { label: "Sales", href: "/sales", icon: <CartIcon /> },
      { label: "Store closes", href: "/stores", icon: <StoreIcon /> },
      { label: "Inventory", href: "/inventory", icon: <BoxesIcon /> },
      { label: "Purchasing", href: "/purchasing", icon: <ClipboardIcon /> },
      { label: "Warehouse", href: "/warehouse", icon: <TruckIcon /> },
      { label: "Suppliers", href: "/suppliers", icon: <HandshakeIcon /> },
      { label: "Finance", href: "/finance", icon: <BookIcon /> },
    ],
  },
];

export const STATUS_CARD = {
  title: "Read-only view",
  description: "Numbers come live from each module. Use “Open full app” on a tab to act on them.",
};
