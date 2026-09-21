import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Point of Sale Terminal — MMS",
  description: "Scan items, apply discounts, process payments, and print receipts.",
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
