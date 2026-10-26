"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Headphones, Loader2, PhoneForwarded, User } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import { apiFetch } from "../session";
import { LiveDot } from "./Primitives";

type Live = {
  id: string; provider: string; fromNumber: string; startedAt: string; status: string; customer: { id: string; name: string | null; companyName: string | null } | null;
  transcript: string | null; liveTranscript: boolean; canTakeOver: boolean; detected: Record<string, string>;
  activities: { id: string; tool: string; text: string; createdAt: string }[];
};
const FIELDS: [string, string][] = [["name", "Name"], ["company", "Firma"], ["postalCode", "PLZ"], ["address", "Adresse"], ["category", "Anliegen"], ["urgency", "Dringlichkeit"], ["employee", "Zuständig"], ["appointment", "Termin"], ["reference", "Vorgang"]];
const URG: Record<string, string> = { LOW: "niedrig", MEDIUM: "normal", HIGH: "hoch", CRITICAL: "Notfall" };
const KEY = "live-takeover-number";

/** Live-Konsole: erscheint nur, wenn gerade Gespräche laufen. Mitschrift, erkannte Daten, Gespräch übernehmen. */
export function LiveCalls() {
  const { data } = usePoll<{ calls: Live[] }>("/api/live", 3000);
  if (!data?.calls.length) return null;
  return (
    <section aria-label="Laufende Gespräche" className="space-y-3">
      <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-zinc-100"><LiveDot color="emerald" />Läuft gerade · {data.calls.length} Gespräch{data.calls.length === 1 ? "" : "e"}</h2>
      {data.calls.map((c) => <LiveCard key={c.id} c={c} />)}
    </section>
  );
}

function LiveCard({ c }: { c: Live }) {
  const [now, setNow] = useState(Date.now());
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { try { setNumber(localStorage.getItem(KEY) ?? ""); } catch { /* ohne Speicher */ } }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [c.transcript]);
  const sec = Math.max(0, Math.round((now - Date.parse(c.startedAt)) / 1000));
  const lines = (c.transcript ?? "").split("\n").filter(Boolean).slice(-40);
  const who = c.customer?.companyName || c.customer?.name || c.detected.name || c.fromNumber;
  const emergency = c.detected.urgency === "CRITICAL";

  async function takeOver() {
    if (!number.trim()) return setMsg({ ok: false, text: "Bitte Ihre Telefonnummer eintragen." });
    if (!confirm(`Gespräch jetzt auf ${number} übernehmen? Eira wird getrennt, Ihr Telefon klingelt sofort.`)) return;
    setBusy(true); setMsg(null);
    try {
      await apiFetch(`/api/live/${c.id}/takeover`, { method: "POST", json: { number } });
      try { localStorage.setItem(KEY, number); } catch { /* egal */ }
      setMsg({ ok: true, text: "Wird verbunden – Ihr Telefon klingelt gleich." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }

  return (
    <article className={cn("glass grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]", emergency && "ring-1 ring-red-500/60")}>
      <div className="min-w-0">
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <Headphones className="h-4 w-4 text-emerald-300" />
          <span className="font-semibold text-zinc-100">{who}</span>
          <span className="font-mono text-xs text-zinc-500">{c.fromNumber}</span>
          <span className="chip border-transparent bg-emerald-400/15 font-mono text-[11px] text-emerald-300">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</span>
          {emergency && <span className="chip border-transparent bg-red-500/20 text-[11px] text-red-200">Notfall</span>}
        </header>
        <div ref={box} className="glass-soft max-h-64 space-y-1.5 overflow-y-auto p-3 text-sm">
          {lines.length ? lines.map((l, i) => {
            const agent = /^(agent|assistant|bot|ki)\s*:/i.test(l);
            return <p key={i} className="flex gap-2"><span className={cn("mt-0.5 shrink-0", agent ? "text-cyan-300" : "text-amber-300")}>{agent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}</span><span className="text-zinc-200">{l.replace(/^[^:]{1,20}:\s*/, "")}</span></p>;
          }) : <p className="text-xs text-zinc-500">{c.liveTranscript ? "Mitschrift erscheint, sobald gesprochen wird …" : "Live-Mitschrift liefert dieser Anbieter erst nach dem Gespräch. Erkannte Daten siehst du rechts."}</p>}
        </div>
        {c.activities.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-zinc-400">
            {c.activities.slice(-5).map((a) => <li key={a.id}>• {new Date(a.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} {a.text}</li>)}
          </ul>
        )}
      </div>
      <aside className="space-y-3">
        <div>
          <h3 className="label mb-1.5">Erkannt</h3>
          <dl className="space-y-1 text-sm">
            {FIELDS.filter(([k]) => c.detected[k]).map(([k, l]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-zinc-500">{l}</dt><dd className="text-right text-zinc-100">{k === "urgency" ? URG[c.detected[k]] ?? c.detected[k] : k === "appointment" && !Number.isNaN(Date.parse(c.detected[k])) ? new Date(c.detected[k]).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : c.detected[k]}</dd></div>
            ))}
            {!FIELDS.some(([k]) => c.detected[k]) && <p className="text-xs text-zinc-500">Noch nichts – Eira fragt gerade nach.</p>}
          </dl>
        </div>
        {c.canTakeOver ? (
          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <h3 className="label">Gespräch übernehmen</h3>
            <input className="input" type="tel" placeholder="Ihre Telefonnummer" value={number} onChange={(e) => setNumber(e.target.value)} />
            <button className="btn-primary w-full justify-center" disabled={busy} onClick={takeOver}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneForwarded className="h-4 w-4" />}Jetzt übernehmen</button>
            {msg && <p className={cn("text-xs", msg.ok ? "text-emerald-300" : "text-amber-300")}>{msg.text}</p>}
          </div>
        ) : <p className="border-t border-zinc-800 pt-3 text-xs text-zinc-500">Übernehmen geht nur bei Anrufen, die über die Twilio-Nummer kommen.</p>}
      </aside>
    </article>
  );
}
