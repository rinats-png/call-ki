"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { EMPLOYEE_ROLES, type EmployeeRole } from "@/lib/constants";
import { cn } from "@/lib/ui";
import { Skeleton } from "@/components/hub/Primitives";
import { PageHero, heroBtn } from "@/components/PageHero";
import { apiFetch, useSession } from "@/components/session";
import type { EmployeeRow } from "@/components/hub/types";

const EMPTY = { id: "", name: "", role: "FIELD_TECH", email: "", servicePostalCodes: "*", directPhone: "", trades: "", active: true };

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

  const active = data?.filter((e) => e.active) ?? [];
  const openSum = data?.reduce((n, e) => n + e.openTickets, 0);
  const areas = new Set(data?.flatMap((e) => e.servicePostalCodes.split(",").map((p) => p.trim())).filter((p) => p && p !== "*"));
  const max = Math.max(5, ...(data ?? []).map((e) => e.openTickets));
  const addBtn = isTenantAdmin ? <button className={heroBtn} onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" />Mitarbeiter</button> : undefined;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHero
        eyebrow="Grundlage für Zuständigkeit, Termine und Benachrichtigungen"
        title="Team & Einsatzgebiete"
        value={data ? active.length : "–"}
        valueLabel={data ? `aktive Mitarbeiter${data.length > active.length ? ` · ${data.length - active.length} inaktiv` : ""}` : ""}
        stats={[
          { label: "Offene Vorgänge", value: openSum ?? "–" },
          { label: "PLZ-Gebiete", value: data ? (data.some((e) => e.servicePostalCodes.includes("*")) && areas.size === 0 ? "alle" : areas.size) : "–" },
          { label: "Notdienst", value: data ? active.filter((e) => e.role === "EMERGENCY_TECH").length : "–" },
        ]}
        action={addBtn}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!data && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}
        {data?.map((e) => {
          const pct = (e.openTickets / max) * 100;
          const tone = pct > 70 ? "stroke-amber-400" : "stroke-cyan-400";
          return (
            <section key={e.id} className={cn("glass flex flex-col gap-4 p-5", !e.active && "opacity-60")}>
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-base font-bold text-cyan-300">
                  {e.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-zinc-50">{e.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <span className={cn("chip", e.role === "EMERGENCY_TECH" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-zinc-700 bg-zinc-950/60 text-zinc-300")}>{roleLabel(e.role)}</span>
                    {!e.active && <span className="chip border-zinc-700 bg-zinc-950/60 text-zinc-500">inaktiv</span>}
                  </div>
                </div>
                {isTenantAdmin && <button className="btn-ghost p-2" onClick={() => setForm({ ...e, email: e.email ?? "", directPhone: e.directPhone ?? "", trades: e.trades ?? "" })} aria-label={`${e.name} bearbeiten`}><Pencil className="h-3.5 w-3.5" /></button>}
              </div>

              <div className="glass-soft flex items-center gap-4 p-3">
                <svg width="52" height="52" viewBox="0 0 40 40" role="img" aria-label={`${e.openTickets} offene Vorgänge`}>
                  <circle cx="20" cy="20" r="15" fill="none" className="stroke-zinc-800" strokeWidth="5" />
                  <circle cx="20" cy="20" r="15" fill="none" className={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(94.2 * Math.min(pct, 100)) / 100} 94.2`} transform="rotate(-90 20 20)" />
                  <text x="20" y="24.5" textAnchor="middle" className="fill-zinc-50 text-[12px] font-bold">{e.openTickets}</text>
                </svg>
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-zinc-100">Offene Vorgänge</div>
                  <div className="text-xs text-zinc-500">{pct > 70 ? "stark ausgelastet" : e.openTickets === 0 ? "frei für neue Aufträge" : "im Rahmen"}</div>
                </div>
              </div>

              <dl className="space-y-1.5 text-xs">
                <Row k="E-Mail / Kalender" v={e.email ?? "—"} />
                <Row k="Direktwahl" v={e.directPhone ?? "—"} />
                <Row k="Gewerke" v={e.trades?.trim() ? e.trades : "alle"} />
              </dl>
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Einsatzgebiet</div>
                <div className="flex flex-wrap gap-1">
                  {e.servicePostalCodes.split(",").map((p) => <span key={p} className="chip border-zinc-700 bg-zinc-950/60 font-mono text-zinc-300">{p.trim() === "*" ? "Überall" : p.trim()}</span>)}
                </div>
              </div>
            </section>
          );
        })}
        {data?.length === 0 && (
          <section className="glass col-span-full p-10 text-center">
            <p className="font-semibold text-zinc-100">Noch keine Mitarbeiter angelegt.</p>
            <p className="mt-1 text-sm text-zinc-500">Legen Sie Ihr Team an, damit die KI Vorgänge der richtigen Person zuweist.</p>
          </section>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 !m-0 grid place-items-center p-4">
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
            <input className="input" placeholder="Gewerke, z. B. Sanitär, Heizung (leer = alle)" value={form.trades} onChange={set("trades")} />
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
