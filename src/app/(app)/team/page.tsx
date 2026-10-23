"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { EMPLOYEE_ROLES, type EmployeeRole } from "@/lib/constants";
import { cn } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiFetch, useSession } from "@/components/session";
import type { EmployeeRow } from "@/components/hub/types";

const EMPTY = { id: "", name: "", role: "FIELD_TECH", email: "", servicePostalCodes: "*", directPhone: "", active: true };

export default function TeamPage() {
  const { me, isTenantAdmin } = useSession();
  const { data, reload } = usePoll<EmployeeRow[]>("/api/employees", 15000);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const roleLabel = (r: string) => me?.tenant?.roleLabels[r as EmployeeRole] ?? r;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setErr(null);
    const { id, ...rest } = form;
    try {
      await apiFetch("/api/employees", { method: "POST", json: { ...rest, ...(id && { id }), directPhone: rest.directPhone || null } });
      setForm(null);
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
    setBusy(false);
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    form && setForm({ ...form, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Team & Einsatzgebiete</h1>
          <p className="text-sm text-zinc-500">Grundlage für die automatische Zuständigkeit, Termine und Benachrichtigungen.</p>
        </div>
        {isTenantAdmin && <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" />Mitarbeiter</button>}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!data && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        {data?.map((e) => (
          <Panel key={e.id} className={cn(!e.active && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/30">
                  {e.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <div>
                  <div className="font-medium text-zinc-100">{e.name}{!e.active && <span className="ml-2 text-xs text-zinc-500">(inaktiv)</span>}</div>
                  <div className="text-xs text-zinc-500">{roleLabel(e.role)}</div>
                </div>
              </div>
              {isTenantAdmin && <button className="btn-ghost p-2" onClick={() => setForm({ ...e, email: e.email ?? "", directPhone: e.directPhone ?? "" })} aria-label="Bearbeiten"><Pencil className="h-3.5 w-3.5" /></button>}
            </div>
            <dl className="mt-4 space-y-1.5 text-xs">
              <Row k="E-Mail / Kalender" v={e.email ?? "—"} />
              <Row k="Direktwahl" v={e.directPhone ?? "—"} />
              <Row k="Offene Vorgänge" v={String(e.openTickets)} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-1">
              {e.servicePostalCodes.split(",").map((p) => <span key={p} className="chip border-zinc-700 bg-zinc-800/60 font-mono text-zinc-300">{p.trim() === "*" ? "Überall" : p.trim()}</span>)}
            </div>
          </Panel>
        ))}
        {data?.length === 0 && <p className="text-sm text-zinc-500">Noch keine Mitarbeiter angelegt.</p>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={() => setForm(null)} />
          <form onSubmit={save} className="glass relative w-full max-w-md space-y-2 p-5 animate-fadein">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100">{form.id ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</h3>
              <button type="button" className="btn-ghost p-2" onClick={() => setForm(null)} aria-label="Schließen"><X className="h-4 w-4" /></button>
            </header>
            <input className="input" placeholder="Name" required value={form.name} onChange={set("name")} />
            <select className="input" value={form.role} onChange={set("role")}>
              {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <input className="input" type="email" placeholder="E-Mail (Benachrichtigungen, Outlook-Kalender)" value={form.email} onChange={set("email")} />
            <input className="input font-mono" placeholder="PLZ-Gebiete: 10115, 12, 13000-13999 oder *" required value={form.servicePostalCodes} onChange={set("servicePostalCodes")} />
            <input className="input" placeholder="Handy für SMS & Notfall-Durchstellung" value={form.directPhone} onChange={set("directPhone")} />
            <label className="flex items-center gap-2 pt-1 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={set("active")} />Aktiv (erhält neue Vorgänge)</label>
            {err && <p className="text-xs text-amber-400">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Abbrechen</button>
              <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Speichern</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="truncate text-zinc-300">{v}</dd>
    </div>
  );
}
