"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { EMPLOYEE_ROLES, ROLE_LABEL, type EmployeeRole } from "@/lib/constants";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import type { EmployeeRow } from "@/components/hub/types";

const EMPTY = { id: "", name: "", role: "PEST_EXPERT", microsoftUpn: "", servicePostalCodes: "", directPhone: "" };

export default function TeamPage() {
  const { data, reload } = usePoll<EmployeeRow[]>("/api/employees", 15000);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setErr(null);
    const { id, directPhone, ...rest } = form;
    const r = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, ...(id && { id }), directPhone: directPhone || null }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(Object.values(j.error?.fieldErrors ?? {}).flat().join(" · ") || "Speichern fehlgeschlagen");
      return;
    }
    setForm(null);
    reload();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => form && setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Team & Einsatzgebiete</h1>
          <p className="text-sm text-zinc-500">Grundlage für das Smart Routing und die Outlook-Kalender.</p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" />Mitarbeiter</button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!data && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        {data?.map((e) => (
          <Panel key={e.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/30">
                  {e.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <div>
                  <div className="font-medium text-zinc-100">{e.name}</div>
                  <div className="text-xs text-zinc-500">{ROLE_LABEL[e.role as EmployeeRole] ?? e.role}</div>
                </div>
              </div>
              <button className="btn-ghost p-2" onClick={() => setForm({ ...e, directPhone: e.directPhone ?? "" })} aria-label="Bearbeiten"><Pencil className="h-3.5 w-3.5" /></button>
            </div>
            <dl className="mt-4 space-y-1.5 text-xs">
              <Row k="Outlook" v={e.microsoftUpn} />
              <Row k="Direktwahl" v={e.directPhone ?? "—"} />
              <Row k="Offene Vorgänge" v={String(e.openTickets)} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-1">
              {e.servicePostalCodes.split(",").map((p) => (
                <span key={p} className="chip border-zinc-700 bg-zinc-800/60 font-mono text-zinc-300">{p.trim() === "*" ? "Überall" : p.trim()}</span>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setForm(null)} />
          <form onSubmit={save} className="glass relative w-full max-w-md space-y-2 p-5 animate-fadein">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100">{form.id ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</h3>
              <button type="button" className="btn-ghost p-2" onClick={() => setForm(null)}><X className="h-4 w-4" /></button>
            </header>
            <input className="input" placeholder="Name" required value={form.name} onChange={set("name")} />
            <select className="input" value={form.role} onChange={set("role")}>
              {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <input className="input" type="email" placeholder="Microsoft UPN (z. B. techniker@storm.gmbh)" required value={form.microsoftUpn} onChange={set("microsoftUpn")} />
            <input className="input font-mono" placeholder="PLZ-Bereiche: 10115, 12, 13000-13999 oder *" required value={form.servicePostalCodes} onChange={set("servicePostalCodes")} />
            <input className="input" placeholder="Direktwahl für Notfall-Durchstellung" value={form.directPhone} onChange={set("directPhone")} />
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
