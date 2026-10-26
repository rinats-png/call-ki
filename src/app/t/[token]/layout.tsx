import type { Metadata, Viewport } from "next";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Einsätze",
    manifest: `/api/public/tech/${encodeURIComponent(token)}/manifest`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    appleWebApp: { capable: true, title: "Einsätze", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0f14" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
