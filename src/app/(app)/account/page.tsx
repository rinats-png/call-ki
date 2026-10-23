"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Loader2, ShieldAlert, ShieldCheck, LogOut } from "lucide-react";
import { cn, fmtDateTime } from "@/lib/ui";
import { USER_ROLE_LABEL, type UserRole } from "@/lib/constants";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiFetch, useSession } from "@/components/session";

type SessionRow = { ref: string; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean };

function device(ua: string | null) {
  if (!ua) return "Unbekanntes Gerät";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return [br, os].filter(Boolean).join(" · ");
}

function AccountInner() {
  const { me, reload } = useSession();
  const forced = useSearchParams().get("setup") === "2fa" || !!me?.mfa.setupRequired;

  const name = me?.user.name ?? me?.user.email ?? "";
  const initials = name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="hero flex flex-wrap items-center gap-5 p-5 md:px-8 md:py-6">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/20 text-xl font-extrabold">{initials || "–"}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm opacity-90">Mein Konto</div>
          <h1 className="truncate text-2xl font-extrabold md:text-3xl">{me?.user.name ?? me?.user.email ?? "…"}</h1>
          <div className="truncate text-sm opacity-90">{me ? `${me.user.email} · ${USER_ROLE_LABEL[me.user.role as UserRole] ?? me.user.role}` : ""}</div>
        </div>
        {me && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            {me.mfa.enabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            {me.mfa.enabled ? "Zwei-Faktor aktiv" : "Zwei-Faktor aus"}
          </span>
        )}
      </section>
      {forced && me?.mfa.setupRequired && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Für Ihre Rolle ist die Zwei-Faktor-Anmeldung Pflicht. Bitte richten Sie sie jetzt ein – danach steht Ihnen die Plattform vollständig zur Verfügung.</span>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <div className="space-y-5">{me ? <TwoFactor enabled={me.mfa.enabled} required={me.mfa.setupRequired || me.isPlatformAdmin} onChange={reload} /> : <Skeleton className="h-48 rounded-3xl" />}</div>
        {!me?.mfa.setupRequired && (
          <div className="space-y-5">
            <PasswordChange />
            <Sessions />
          </div>
        )}
      </div>
    </div>
  );
}

function TwoFactor({ enabled, required, onChange }: { enabled: boolean; required: boolean; onChange: () => Promise<void> }) {
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <Panel
      title={<h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">{enabled ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />}Zwei-Faktor-Anmeldung</h2>}
      action={<span className={cn("chip", enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400")}>{enabled ? "Aktiv" : "Nicht eingerichtet"}</span>}
    >
      <p className="mb-4 text-sm text-zinc-400">Zusätzlich zum Passwort fragt die Anmeldung einen Code aus einer Authenticator-App ab (z. B. Microsoft Authenticator, Google Authenticator, 1Password).</p>

      {codes && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="mb-2 text-sm font-medium text-emerald-300">Ihre Wiederherstellungscodes – jetzt sicher aufbewahren (z. B. im Passwort-Manager). Sie werden nur einmal angezeigt.</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm text-zinc-100 sm:grid-cols-5">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <button className="btn-ghost mt-3 text-xs" onClick={() => navigator.clipboard.writeText(codes.join("\n"))}><Copy className="h-3.5 w-3.5" />Kopieren</button>
        </div>
      )}

      {!enabled && !setup && (
        <button className="btn-primary" disabled={busy} onClick={() => run(async () => setSetup(await apiFetch("/api/auth/2fa/setup", { method: "POST" })))}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Einrichtung starten
        </button>
      )}

      {!enabled && setup && (
        <form
          className="grid gap-4 sm:grid-cols-[180px_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get("code") ?? "");
            run(async () => {
              const r = await apiFetch<{ recoveryCodes: string[] }>("/api/auth/2fa/enable", { method: "POST", json: { code } });
              setCodes(r.recoveryCodes);
              setSetup(null);
              await onChange();
            });
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="QR-Code für die Authenticator-App" className="w-[180px] rounded-lg bg-white p-2" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qrSvg)}`} />
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">1. QR-Code mit der Authenticator-App scannen.</p>
            <p className="text-xs text-zinc-500">Kein Scan möglich? Schlüssel manuell eingeben: <code className="break-all font-mono text-zinc-300">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code></p>
            <p className="text-sm text-zinc-300">2. Den angezeigten 6-stelligen Code eingeben:</p>
            <div className="flex gap-2">
              <input className="input max-w-[160px] font-mono tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} />
              <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Aktivieren</button>
            </div>
          </div>
        </form>
      )}

      {enabled && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" disabled={busy} onClick={() => run(async () => setCodes((await apiFetch<{ recoveryCodes: string[] }>("/api/auth/2fa/recovery", { method: "POST" })).recoveryCodes))}>Neue Wiederherstellungscodes</button>
          {!required && (
            <button className="btn-ghost text-xs text-amber-300" disabled={busy} onClick={() => run(async () => {
              if (!confirm("Zwei-Faktor-Anmeldung wirklich deaktivieren?")) return;
              await apiFetch("/api/auth/2fa/disable", { method: "POST" });
              await onChange();
            })}>Deaktivieren</button>
          )}
        </div>
      )}
      {msg && <p className={cn("mt-3 text-xs", msg.ok ? "text-emerald-400" : "text-amber-400")}>{msg.text}</p>}
    </Panel>
  );
}

function PasswordChange() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (v.newPassword !== v.newPassword2) return setMsg({ ok: false, text: "Die neuen Passwörter stimmen nicht überein." });
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch("/api/auth/password", { method: "POST", json: { currentPassword: v.currentPassword, newPassword: v.newPassword } });
      form.reset();
      setMsg({ ok: true, text: "Passwort geändert. Andere Geräte wurden abgemeldet." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
    setBusy(false);
  }
  return (
    <Panel title="Passwort ändern">
      <form onSubmit={submit} className="grid gap-2">
        <input className="input" name="currentPassword" type="password" placeholder="Aktuelles Passwort" aria-label="Aktuelles Passwort" autoComplete="current-password" required />
        <input className="input" name="newPassword" type="password" placeholder="Neues Passwort (min. 12 Zeichen)" aria-label="Neues Passwort" autoComplete="new-password" required minLength={12} />
        <input className="input" name="newPassword2" type="password" placeholder="Neues Passwort wiederholen" aria-label="Neues Passwort wiederholen" autoComplete="new-password" required />
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-xs", msg?.ok ? "text-emerald-400" : "text-amber-400")}>{msg?.text}</span>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Speichern</button>
        </div>
      </form>
    </Panel>
  );
}

function Sessions() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const load = useCallback(async () => setRows(await apiFetch<SessionRow[]>("/api/auth/sessions")), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Panel
      title="Angemeldete Geräte"
      action={rows && rows.length > 1 ? <button className="btn-ghost py-1 text-xs" onClick={async () => { await apiFetch("/api/auth/sessions", { method: "DELETE" }); load(); }}><LogOut className="h-3.5 w-3.5" />Andere abmelden</button> : null}
    >
      {!rows ? <Skeleton className="h-16" /> : (
        <ul className="divide-y divide-zinc-800 text-sm">
          {rows.map((s) => (
            <li key={s.ref} className="flex items-center justify-between gap-2 py-2">
              <span className="text-zinc-200">{device(s.userAgent)} {s.current && <span className="chip ml-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Dieses Gerät</span>}</span>
              <span className="text-xs text-zinc-500">aktiv {fmtDateTime(s.lastSeenAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function Page() {
  return <Suspense><AccountInner /></Suspense>;
}
