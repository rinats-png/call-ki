import { CheckCircle2, AlertTriangle, XCircle, Zap } from "lucide-react";
import { prisma } from "@/lib/db";
import { ensurePlatformConfig, setting } from "@/lib/platform/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status · KI-Telefonzentrale", robots: { index: false } };

type State = "ok" | "degraded" | "down";

/** Öffentliche Statusseite für Kunden: ohne Kundendaten, nur Betriebszustand und Hinweis des Betreibers. */
export default async function StatusPage() {
  await ensurePlatformConfig();
  let db: State = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }
  const voice: State = db === "down" ? "degraded" : setting("AI_KILL_SWITCH") === "on" ? "degraded" : "ok";
  const notice = setting("STATUS_NOTICE")?.trim();
  const rows: { name: string; state: State; text: string }[] = [
    { name: "Kundenportal", state: db, text: db === "ok" ? "In Betrieb" : "Gestört – wir arbeiten daran" },
    {
      name: "Telefonannahme durch die KI",
      state: voice,
      text: voice === "ok" ? "In Betrieb" : "Eingeschränkt – Anrufe gehen an die hinterlegten Ersatznummern bzw. die Mailbox",
    },
  ];
  const overall: State = rows.some((r) => r.state === "down") ? "down" : rows.some((r) => r.state === "degraded") ? "degraded" : "ok";
  const Icon = { ok: CheckCircle2, degraded: AlertTriangle, down: XCircle };
  const color = { ok: "text-emerald-400", degraded: "text-amber-400", down: "text-rose-400" };
  const OverallIcon = Icon[overall];
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/20"><Zap className="h-5 w-5 text-cyan-300" /></span>
        <span className="text-lg font-extrabold text-zinc-50">{setting("PLATFORM_NAME") || "KI-Telefonzentrale"} · Status</span>
      </div>
      <section className="glass flex items-center gap-3 p-5" aria-live="polite">
        <OverallIcon className={`h-7 w-7 ${color[overall]}`} aria-hidden />
        <h1 className="text-xl font-bold text-zinc-50">{overall === "ok" ? "Alle Systeme in Betrieb" : overall === "degraded" ? "Eingeschränkter Betrieb" : "Störung"}</h1>
      </section>
      {notice && <section className="glass border-l-4 border-amber-400 p-4 text-sm text-zinc-200"><b>Hinweis:</b> {notice}</section>}
      <ul className="glass divide-y divide-zinc-800 p-2">
        {rows.map((r) => {
          const I = Icon[r.state];
          return (
            <li key={r.name} className="flex items-start gap-3 px-3 py-3">
              <I className={`mt-0.5 h-5 w-5 shrink-0 ${color[r.state]}`} aria-hidden />
              <div><div className="font-semibold text-zinc-100">{r.name}</div><div className="text-sm text-zinc-400">{r.text}</div></div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500">Stand: {new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} Uhr. Fällt unser Server ganz aus, leitet die Telefonanlage Anrufe automatisch an Ihre Ersatznummer weiter.</p>
    </main>
  );
}
