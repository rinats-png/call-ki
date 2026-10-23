import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Storm Hub · KI-Telefonzentrale",
  description: "Autonome KI-Telefonzentrale der Storm GmbH – Schädlingsbekämpfung",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#09090b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
