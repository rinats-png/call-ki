"use client";

import { useState } from "react";
import { Copy, Loader2, Send, Trash2, Webhook } from "lucide-react";
import { cn } from "@/lib/ui";
import { usePoll } from "@/lib/use-poll";
import { Panel } from "@/components/hub/Primitives";
import { InfoTip } from "@/components/InfoTip";
import { apiFetch } from "@/components/session";

type Endpoint = {
  id: string; url: string; events: string[]; active: boolean; lastStatus: string | null; lastAt: string | null;
  deliveries: { id: string; event: string; status: string; attempts: number; lastError: string | null; createdAt: string }[];
};
type Data = { enabled: boolean; events: string[]; endpoints: Endpoint[] };

const EVENT_LABEL: Record<string, string> = { "ticket.created": "Neuer Vorgang", "ticket.updated": "Vorgang geändert", "call.ended": "Anruf beendet" };

/** Webhooks für eigene Systeme (Kunden-Admin): anlegen, testen, pausieren, löschen. */
export function WebhooksPanel() {
  const { data, reload } = usePoll<Data>("/api/webhooks", 0);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["ticket.created"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data) return null;

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const t = await fn();
      if (t) setMsg({ ok: true, text: t });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={<h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><Webhook className="h-4 w-4 text-cyan-300" />Webhooks<InfoTip title="Webhooks" steps={["Schickt neue und geänderte Vorgänge sowie beendete Anrufe automatisch an Ihre Systeme – z. B. CRM, Zapier, Make oder Ihre Warenwirtschaft.", "Jede Nachricht ist signiert: Kopfzeile X-CallKI-Signature „t=<Zeit>,v1=<HMAC-SHA256>“ über „<Zeit>.<Inhalt>“ mit Ihrem Geheimnis. Prüfen Sie die Signatur und verwerfen Sie Nachrichten, die älter als 5 Minuten sind.", "Nur https-Adressen. Schlägt die Zustellung fehl, wird bis zu sechsmal mit wachsender Pause wiederholt.", "Die Daten enthalten Kundendaten (Name, Telefon, Adresse) – nur an Systeme senden, für die Sie verantwortlich sind."]} /></h2>}>
      {!data.enabled ? (
        <p className="text-sm text-zinc-400">Webhooks sind in Ihrem Paket nicht enthalten.</p>
      ) : (
        <div className="space-y-3">
          {data.endpoints.map((e) => (
            <div key={e.id} className="glass-soft space-y-1 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{e.url}</span>
                <span className={cn("chip", e.lastStatus === "OK" ? "border-emerald-500/30 text-emerald-300" : e.lastStatus ? "border-amber-500/30 text-amber-300" : "border-zinc-700 text-zinc-400")}>{e.lastStatus ?? "noch nichts gesendet"}</span>
                <button className="btn-ghost py-1 text-xs" disabled={busy} onClick={() => run(async () => {
                  const r = await apiFetch<{ ok: boolean; error: string | null }>(`/api/webhooks/${e.id}/test`, { method: "POST" });
                  if (!r.ok) throw new Error(`Test fehlgeschlagen: ${r.error ?? "unbekannt"}`);
                  return "Test erfolgreich zugestellt.";
                })}><Send className="h-3.5 w-3.5" />Test</button>
                <button className="btn-ghost py-1 text-xs" disabled={busy} onClick={() => run(async () => { await apiFetch(`/api/webhooks/${e.id}`, { method: "PATCH", json: { active: !e.active } }); })}>{e.active ? "Pausieren" : "Aktivieren"}</button>
                <button className="btn-ghost py-1 text-xs text-rose-300" disabled={busy} aria-label="Webhook löschen" onClick={() => confirm("Webhook löschen?") && run(async () => { await apiFetch(`/api/webhooks/${e.id}`, { method: "DELETE" }); })}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="text-xs text-zinc-500">{e.events.map((x) => EVENT_LABEL[x] ?? x).join(" · ")}{e.active ? "" : " · pausiert"}</div>
            </div>
          ))}
          {secret && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="text-amber-200">Signatur-Geheimnis – wird nur jetzt angezeigt:</p>
              <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate">{secret}</code><button className="btn-ghost py-1 text-xs" onClick={() => navigator.clipboard?.writeText(secret)}><Copy className="h-3.5 w-3.5" />Kopieren</button></div>
            </div>
          )}
          <form className="space-y-2" onSubmit={(ev) => {
            ev.preventDefault();
            run(async () => {
              const r = await apiFetch<{ secret: string }>("/api/webhooks", { method: "POST", json: { url, events } });
              setSecret(r.secret);
              setUrl("");
              return "Webhook angelegt.";
            });
          }}>
            <input className="input" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ihr-system.example/webhooks/telefon" aria-label="Webhook-Adresse" />
            <div className="flex flex-wrap gap-3 text-sm text-zinc-300">
              {data.events.map((x) => (
                <label key={x} className="flex items-center gap-2"><input type="checkbox" checked={events.includes(x)} onChange={(e) => setEvents((s) => (e.target.checked ? [...s, x] : s.filter((y) => y !== x)))} />{EVENT_LABEL[x] ?? x}</label>
              ))}
            </div>
            <button className="btn-primary" disabled={busy || !url || !events.length}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Webhook hinzufügen</button>
          </form>
          {msg && <p role="status" className={cn("text-sm", msg.ok ? "text-emerald-300" : "text-amber-300")}>{msg.text}</p>}
        </div>
      )}
    </Panel>
  );
}
