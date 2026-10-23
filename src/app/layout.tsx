import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KI-Telefonzentrale", template: "%s · KI-Telefonzentrale" },
  description: "KI-Telefonassistenz für Handwerk & Dienstleister – Anrufe annehmen, Termine planen, Notfälle eskalieren.",
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
        {children}
      </body>
    </html>
  );
}
