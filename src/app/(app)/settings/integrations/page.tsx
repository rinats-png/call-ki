"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, Phone, Mail, MessageSquare, Bot, CalendarDays } from "lucide-react";
import { cn } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiFetch, useSession } from "@/components/session";
import { InfoTip } from "@/components/InfoTip";

type Integrations = {
  platform: { microsoftAvailable: boolean; googleAvailable: boolean; email: boolean; sms: boolean; voice: boolean };
  planAllowsCalendar: boolean;
  google: { status: string; account?: string | null; lastError?: string | null };
  microsoft: { status: string; msTenantId?: string | null; draftMailbox?: string; lastError?: string | null };
  numbers: { e164: string; label: string | null; fallbackNumber: string | null }[];
};

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("chip", ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-800 text-zinc-400")}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{label}
    </span>
  );
}

function IntegrationsInner() {
  const { isTenantAdmin } = useSession();
  const q = useSearchParams();
  const [d, setD] = useState<Integrations | null>(null);
  const [mailbox, setMailbox] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    q.get("ms") === "connected" ? { ok: true, text: "Microsoft 365 ist verbunden." } : q.get("google") === "connected" ? { ok: true, text: "Google Kalender ist verbunden." } : q.get("ms") === "error" || q.get("google") === "error" ? { ok: false, text: `Verbindung fehlgeschlagen: ${q.get("reason") ?? ""}` } : null,
  );

  const load = useCallback(async () => {
    const r = await apiFetch<Integrations>("/api/integrations");
    setD(r);
    setMailbox(r.microsoft.draftMailbox ?? "");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }

  if (!d) return <Skeleton className="h-96" />;
  const ms = d.microsoft;
  const connected = ms.status === "CONNECTED";

  return (
    <div className="space-y-5">
      <Panel title={<h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><Phone className="h-4 w-4 text-cyan-300" />Rufnummer<InfoTip title="Rufumleitung einrichten" steps={["Ihre bisherige Nummer bleibt. Sie leiten Anrufe auf die unten stehende Nummer um.", "Telekom-Festnetz: *21*Zielnummer# (immer), *61*Zielnummer# (nach ca. 20 s), *67*Zielnummer# (bei besetzt). Abschalten: #21#, #61#, #67#.", "Fritz!Box: Telefonie → Rufbehandlung → Rufumleitung → Neue Rufumleitung → Ziel = unten stehende Nummer.", "sipgate / Placetel / easybell: im Kundenportal unter Rufnummer → Weiterleitung bzw. Rufumleitung.", "Mobilfunk: **21*Zielnummer# (alle), **61*Zielnummer# (bei Nichtannahme).", "Tipp: Zunächst nur „bei besetzt / nach 20 s“ umleiten, um die KI kennenzulernen."]} /></h2>}>
        {d.numbers.length ? (
          <ul className="space-y-2 text-sm">
            {d.numbers.map((n) => (
              <li key={n.e164} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-zinc-100">{n.e164}</span>
                <span className="text-xs text-zinc-500">{n.label ?? ""}{n.fallbackNumber ? ` · Fallback ${n.fallbackNumber}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Noch keine Nummer zugewiesen – wird von Ihrem Anbieter eingerichtet.</p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Tipp: Behalten Sie Ihre bisherige Nummer und richten Sie eine <b>Rufumleitung</b> auf diese Nummer ein – z. B. „bei besetzt / nach 20 Sekunden / außerhalb der Geschäftszeiten“. Die Einstellung finden Sie in Ihrer Telefonanlage oder beim Telefonanbieter.
        </p>
      </Panel>

      <Panel title={<h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><CalendarDays className="h-4 w-4 text-cyan-300" />Microsoft 365 (Outlook)</h2>} action={<Status ok={connected} label={connected ? "Verbunden" : "Nicht verbunden"} />}>
        <p className="mb-3 text-sm text-zinc-400">
          Optional. Ohne Verbindung arbeitet der interne Kalender und Termine gehen per E-Mail mit Kalendereintrag raus. Mit Verbindung prüft die KI die echten Outlook-Kalender Ihrer Mitarbeiter und trägt Termine direkt ein.
        </p>
        {!d.platform.microsoftAvailable && <p className="text-xs text-amber-400">Auf der Plattform noch nicht freigeschaltet – bitte Ihren Anbieter kontaktieren.</p>}
        {ms.lastError && <p className="mb-2 text-xs text-amber-400">Letzter Fehler: {ms.lastError}</p>}
        {isTenantAdmin && d.platform.microsoftAvailable && (
          <div className="space-y-3">
            {!connected ? (
              <button className="btn-primary" disabled={busy === "connect"} onClick={() => act("connect", async () => { const r = await apiFetch<{ url: string }>("/api/integrations/microsoft", { method: "POST" }); location.href = r.url; })}>
                {busy === "connect" && <Loader2 className="h-4 w-4 animate-spin" />}Mit Microsoft 365 verbinden
              </button>
            ) : (
              <>
                <p className="text-xs text-zinc-500">Microsoft-Tenant: <span className="font-mono">{ms.msTenantId}</span>. Kalender werden über die E-Mail-Adresse der Mitarbeiter (Team) angesprochen.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className="input sm:flex-1" type="email" value={mailbox} onChange={(e) => setMailbox(e.target.value)} placeholder="Postfach für E-Mail-Entwürfe, z. B. info@ihre-firma.de" />
                  <button className="btn-ghost" disabled={busy === "mb"} onClick={() => act("mb", async () => { await apiFetch("/api/integrations/microsoft", { method: "PUT", json: { draftMailbox: mailbox } }); setMsg({ ok: true, text: "Postfach geprüft und gespeichert." }); await load(); })}>
                    {busy === "mb" && <Loader2 className="h-4 w-4 animate-spin" />}Prüfen & speichern
                  </button>
                </div>
                <button className="btn-ghost text-xs text-amber-300" onClick={() => act("dc", async () => { if (!confirm("Microsoft 365 trennen?")) return; await apiFetch("/api/integrations/microsoft", { method: "DELETE" }); await load(); })}>Verbindung trennen</button>
              </>
            )}
            <p className="text-[11px] leading-relaxed text-zinc-500">Für die Verbindung ist ein Microsoft-365-Administrator nötig. Freigegeben werden: Kalender lesen/schreiben und E-Mail-Entwürfe anlegen. Empfehlung: Zugriff per „Application Access Policy“ auf die relevanten Postfächer begrenzen.</p>
          </div>
        )}
        {msg && <p className={cn("mt-3 text-xs", msg.ok ? "text-emerald-400" : "text-amber-400")}>{msg.text}</p>}
      </Panel>

      <Panel title={<h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><CalendarDays className="h-4 w-4 text-cyan-300" />Google Kalender<InfoTip title="Google Kalender verbinden" steps={["Als Administrator auf „Mit Google verbinden“ klicken und mit dem Google-Konto anmelden, das Zugriff auf die Kalender Ihrer Mitarbeiter hat.", "Die KI prüft Belegungen im Kalender jedes Mitarbeiters (Kalender-ID = dessen E-Mail-Adresse unter Team) und trägt Termine dort ein.", "Google Workspace: Kalender der Mitarbeiter für das verbindende Konto mit „Änderungen an Terminen vornehmen“ freigeben.", "Trennen jederzeit möglich – der Zugriff wird dabei auch bei Google widerrufen."]} /></h2>} action={<Status ok={d.google.status === "CONNECTED"} label={d.google.status === "CONNECTED" ? "Verbunden" : "Nicht verbunden"} />}>
        <p className="mb-3 text-sm text-zinc-400">Alternative zu Outlook. Es wird immer nur ein externer Kalender genutzt – ist Microsoft 365 verbunden, hat er Vorrang.</p>
        {!d.platform.googleAvailable && <p className="text-xs text-amber-400">Auf der Plattform noch nicht freigeschaltet – bitte Ihren Anbieter kontaktieren.</p>}
        {d.platform.googleAvailable && !d.planAllowsCalendar && <p className="text-xs text-amber-400">In Ihrem Paket nicht enthalten.</p>}
        {d.google.lastError && <p className="mb-2 text-xs text-amber-400">Letzter Fehler: {d.google.lastError}</p>}
        {isTenantAdmin && d.platform.googleAvailable && d.planAllowsCalendar && (
          d.google.status !== "CONNECTED" ? (
            <button className="btn-primary" disabled={busy === "g"} onClick={() => act("g", async () => { const r = await apiFetch<{ url: string }>("/api/integrations/google", { method: "POST" }); location.href = r.url; })}>
              {busy === "g" && <Loader2 className="h-4 w-4 animate-spin" />}Mit Google verbinden
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Verbunden als <span className="font-mono">{d.google.account ?? "Google-Konto"}</span>.</p>
              <button className="btn-ghost text-xs text-amber-300" onClick={() => act("gdc", async () => { if (!confirm("Google Kalender trennen?")) return; await apiFetch("/api/integrations/google", { method: "DELETE" }); await load(); })}>Verbindung trennen</button>
            </div>
          )
        )}
      </Panel>

      <Panel title="Dienste der Plattform">
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-sm text-zinc-400"><Bot className="h-4 w-4" /><Status ok={d.platform.voice} label="KI-Telefonie" /></span>
          <span className="flex items-center gap-1.5 text-sm text-zinc-400"><Mail className="h-4 w-4" /><Status ok={d.platform.email} label="E-Mail-Versand" /></span>
          <span className="flex items-center gap-1.5 text-sm text-zinc-400"><MessageSquare className="h-4 w-4" /><Status ok={d.platform.sms} label="SMS-Versand" /></span>
        </div>
      </Panel>
    </div>
  );
}

export default function Page() {
  return <Suspense><IntegrationsInner /></Suspense>;
}
