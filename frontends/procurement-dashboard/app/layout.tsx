import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthGate, AuthProvider, FlashProvider, MMS_APPS } from "@mms/ui";
import "@mms/ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Procurement Dashboard — MMS",
  description: "Create purchase orders, route approvals, and view open orders.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <FlashProvider>
          <AuthProvider>
            <AuthGate appName={MMS_APPS.procurement.name} allow={MMS_APPS.procurement.allow}>
              {children}
            </AuthGate>
          </AuthProvider>
        </FlashProvider>
      </body>
    </html>
  );
}
