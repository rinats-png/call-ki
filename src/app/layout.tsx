import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/figtree";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KI-Telefonzentrale", template: "%s · KI-Telefonzentrale" },
  description: "KI-Telefonassistenz für Handwerk & Dienstleister – Anrufe annehmen, Termine planen, Notfälle eskalieren.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf1ee" },
    { media: "(prefers-color-scheme: dark)", color: "#13262a" },
  ],
};

// Setzt das Theme vor dem ersten Rendern (kein Aufblitzen): gespeicherte Wahl, sonst Systemeinstellung.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce aus der Middleware (CSP ohne unsafe-inline für Skripte)
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
