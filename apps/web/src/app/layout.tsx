import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "RaktFlow — blood before the festival, not after",
  description: "Forecasts festive-season blood shortages weeks ahead and calls donors before they travel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
