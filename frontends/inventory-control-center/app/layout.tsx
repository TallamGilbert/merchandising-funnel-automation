import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthGate, AuthProvider, FlashProvider } from "@mms/ui";
import "@mms/ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Inventory Control Center — MMS",
  description: "Browse stock levels, perform adjustments, and view valuation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <FlashProvider>
          <AuthProvider>
            <AuthGate appName="Inventory Control Center" allow={["OWNER", "MANAGER", "BUYER", "WAREHOUSE_STAFF"]}>
              {children}
            </AuthGate>
          </AuthProvider>
        </FlashProvider>
      </body>
    </html>
  );
}
