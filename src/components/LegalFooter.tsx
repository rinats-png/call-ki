import { connection } from "next/server";

/** Impressum- und Datenschutz-Links des Plattformbetreibers (URLs zur Laufzeit aus der Umgebung). */
export async function LegalFooter() {
  await connection(); // nicht beim Build einfrieren – URLs kommen aus der .env des Servers
  const links = [
    { href: process.env.LEGAL_IMPRINT_URL, label: "Impressum" },
    { href: process.env.LEGAL_PRIVACY_URL, label: "Datenschutz" },
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
