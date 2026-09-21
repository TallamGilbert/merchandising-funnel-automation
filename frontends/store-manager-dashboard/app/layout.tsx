import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store Manager Dashboard — MMS",
  description: "Enter cash counts, compare against expected totals, and close registers.",
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
