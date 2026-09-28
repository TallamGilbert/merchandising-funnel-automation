import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FlashProvider } from "@mms/ui";
import "@mms/ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Point of Sale Terminal — MMS",
  description: "Scan items, apply discounts, process payments, and print receipts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <FlashProvider>{children}</FlashProvider>
      </body>
    </html>
  );
}
