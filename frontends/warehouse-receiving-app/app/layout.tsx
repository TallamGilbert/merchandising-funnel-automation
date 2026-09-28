import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FlashProvider } from "@mms/ui";
import "@mms/ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Warehouse Receiving App — MMS",
  description: "Scan and check off deliveries against approved POs.",
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
