import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Termin buchen", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
