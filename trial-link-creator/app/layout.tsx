import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";
export const metadata: Metadata = {
  title: "ShortMonk internal",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
