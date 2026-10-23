"use client";

import { useState } from "react";
import { Loader2, Copy } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { fmtDateTime } from "@/lib/ui";
import { USER_ROLE_LABEL, type UserRole } from "@/lib/constants";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiFetch, useSession } from "@/components/session";

type U = { id: string; email: string; name: string | null; role: UserRole; disabled: boolean; lastLoginAt: string | null; invitePending: boolean };

export default function Page() {
  const { me } = useSession();
  const { data, reload } = usePoll<U[]>("/api/users", 0);
  const [f, setF] = useState({ email: "", name: "", role: "TENANT_USER" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ inviteLink: string | null }>("/api/users", { method: "POST", json: f });
      setMsg({ ok: true, text: r.inviteLink ? "Kein E-Mail-Versand eingerichtet – Link bitte selbst weitergeben:" : "Einladung wurde per E-Mail versendet.", link: r.inviteLink ?? undefined });
      setF({ email: "", name: "", role: "TENANT_USER" });
      reload();
    } catch (e2) {
      setMsg({ ok: false, text: (e2 as Error).message });
    }
    setBusy(false);
  }

  async function update(id: string, body: Record<string, unknown>) {
    try {
      const r = await apiFetch<{ link: string | null }>(`/api/users/${id}`, { method: "PATCH", json: body });
      if (r.link) setMsg({ ok: true, text: "Link (kein E-Mail-Versand eingerichtet):", link: r.link });
      else if (body.action) setMsg({ ok: true, text: "E-Mail wurde versendet." });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <div className="space-y-5">
      <Panel title="Benutzer einladen">
        <form onSubmit={invite} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input className="input" type="email" required placeholder="E-Mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className="input" placeholder="Name (optional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="TENANT_USER">Mitarbeiter</option>
            <option value="TENANT_ADMIN">Administrator</option>
          </select>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Einladen</button>
        </form>
        <p className="mt-2 text-[11px] text-zinc-500">Mitarbeiter sehen Vorgänge, Anrufe und Kunden. Administratoren verwalten zusätzlich Team, Einstellungen und Benutzer.</p>
        {msg && (
          <div className={msg.ok ? "mt-3 text-xs text-emerald-400" : "mt-3 text-xs text-amber-400"}>
            {msg.text}
            {msg.link && (
              <div className="mt-1 flex items-center gap-2">
                <code className="block flex-1 truncate rounded bg-zinc-950 px-2 py-1 font-mono text-zinc-300">{msg.link}</code>
                <button className="btn-ghost p-1.5" onClick={() => navigator.clipboard.writeText(msg.link!)} aria-label="Kopieren"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        )}
      </Panel>
      <Panel title="Zugänge">
        {!data ? <Skeleton className="h-32" /> : (
          <ul className="divide-y divide-zinc-800">
            {data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-100">{u.name ?? u.email} {u.id === me?.user.id && <span className="text-xs text-zinc-500">(Sie)</span>}</div>
                  <div className="text-xs text-zinc-500">{u.email} · {u.invitePending ? "Einladung offen" : u.lastLoginAt ? `zuletzt ${fmtDateTime(u.lastLoginAt)}` : "noch nicht angemeldet"}{u.disabled && " · gesperrt"}</div>
                </div>
                <select className="input w-auto py-1 text-xs" value={u.role} disabled={u.id === me?.user.id} onChange={(e) => update(u.id, { role: e.target.value })}>
                  <option value="TENANT_USER">{USER_ROLE_LABEL.TENANT_USER}</option>
                  <option value="TENANT_ADMIN">{USER_ROLE_LABEL.TENANT_ADMIN}</option>
                </select>
                <button className="btn-ghost py-1 text-xs" onClick={() => update(u.id, { action: u.invitePending ? "resend_invite" : "reset_password" })}>{u.invitePending ? "Einladung erneut" : "Passwort-Link"}</button>
                {u.id !== me?.user.id && <button className="btn-ghost py-1 text-xs" onClick={() => update(u.id, { disabled: !u.disabled })}>{u.disabled ? "Entsperren" : "Sperren"}</button>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
