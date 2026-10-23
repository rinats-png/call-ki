import { connection } from "next/server";
import { ensurePlatformConfig, setting } from "@/lib/platform/config";

/** Impressum- und Datenschutz-Links des Plattformbetreibers (URLs zur Laufzeit aus der Umgebung). */
export async function LegalFooter() {
  await connection(); // nicht beim Build einfrieren – URLs kommen aus Einstellungen bzw. .env
  await ensurePlatformConfig();
  const links = [
    { href: setting("LEGAL_IMPRINT_URL"), label: "Impressum" },
    { href: setting("LEGAL_PRIVACY_URL"), label: "Datenschutz" },
  ].filter((l): l is { href: string; label: string } => !!l.href);
  if (!links.length) return null;
  return (
    <footer className="relative flex justify-center gap-4 px-4 py-4 text-[11px] text-zinc-500">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">{l.label}</a>
      ))}
    </footer>
  );
}
