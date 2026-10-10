import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthGate, AuthProvider, FlashProvider } from "@mms/ui";
import "@mms/ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Store Manager Dashboard — MMS",
  description: "Enter cash counts, compare against expected totals, and close registers.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <FlashProvider>
          <AuthProvider>
            <AuthGate appName="Store Manager Dashboard" allow={["OWNER", "MANAGER"]}>
              {children}
            </AuthGate>
          </AuthProvider>
        </FlashProvider>
      </body>
    </html>
  );
}
