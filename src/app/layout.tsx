import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lichtstudio",
  description: "Interne Produktverwaltung LICHT.ENGROS / Eisenkeil",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
