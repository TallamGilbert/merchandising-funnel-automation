import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Procurement Dashboard — MMS",
  description: "Create purchase orders, route approvals, and view open orders.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
