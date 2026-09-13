import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Portal — MMS",
  description: "View accounts payable, the general ledger, and profitability reports.",
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
