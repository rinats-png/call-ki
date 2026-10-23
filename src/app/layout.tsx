import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Storm Hub · KI-Telefonzentrale",
  description: "Autonome KI-Telefonzentrale der Storm GmbH – Schädlingsbekämpfung",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0f4" },
    { media: "(prefers-color-scheme: dark)", color: "#1e2229" },
  ],
};

// Setzt das Theme vor dem ersten Rendern (kein Aufblitzen): gespeicherte Wahl, sonst Systemeinstellung.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
