"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, X, Loader2, Copy, ArrowRight } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, TENANT_STATUS_LABEL, TENANT_STATUS_STYLE } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiFetch } from "@/components/session";

type TenantRow = {
  id: string; name: string; slug: string; industry: string; status: string; plan: string; monthlyMinuteLimit: number | null; createdAt: string;
  phoneNumbers: { e164: string }[]; integrations: { type: string; status: string }[];
  _count: { users: number; employees: number; customers: number };
  usage: { calls: number; minutes: number; tickets: number };
};
type Overview = { templates: { key: string; label: string }[] };

export default function AdminPage() {
  const { data, reload } = usePoll<TenantRow[]>("/api/admin/tenants", 30000);
  const { data: ov } = usePoll<Overview>("/api/admin/overview", 0);
  const [create, setCreate] = useState(false);
  const label = (k: string) => ov?.templates.find((t) => t.key === k)?.label ?? k;
  const totals = data?.reduce((a, t) => ({ minutes: a.minutes + t.usage.minutes, calls: a.calls + t.usage.calls }), { minutes: 0, calls: 0 });

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Mandanten</h1>
          <p className="text-sm text-zinc-500">{data ? `${data.length} Kunden · ${totals?.calls ?? 0} Anrufe · ${totals?.minutes ?? 0} Minuten diesen Monat` : "Lade…"}</p>
        </div>
        <button className="btn-primary" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Neuer Kunde</button>
      </header>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3 font-medium">Kunde</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Rufnummer</th>
                <th className="py-2 pr-3 font-medium">Anrufe / Min. (Monat)</th><th className="py-2 pr-3 font-medium">Limit</th><th className="py-2 pr-3 font-medium">Outlook</th><th />
              </tr>
            </thead>
            <tbody>
              {!data && <tr><td colSpan={7} className="py-2"><Skeleton className="h-10" /></td></tr>}
              {data?.map((t) => {
                const ms = t.integrations.find((i) => i.type === "MICROSOFT_365");
                const pct = t.monthlyMinuteLimit ? Math.round((t.usage.minutes / t.monthlyMinuteLimit) * 100) : null;
                return (
                  <tr key={t.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                    <td className="py-3 pr-3"><div className="font-medium text-zinc-100">{t.name}</div><div className="text-xs text-zinc-500">{label(t.industry)} · {t.plan}</div></td>
                    <td className="py-3 pr-3"><span className={cn("chip", TENANT_STATUS_STYLE[t.status])}>{TENANT_STATUS_LABEL[t.status] ?? t.status}</span></td>
                    <td className="py-3 pr-3 font-mono text-xs text-zinc-300">{t.phoneNumbers.map((n) => n.e164).join(", ") || <span className="text-amber-400">fehlt</span>}</td>
                    <td className="py-3 pr-3 tabular-nums text-zinc-300">{t.usage.calls} / {t.usage.minutes}</td>
                    <td className={cn("py-3 pr-3 tabular-nums text-xs", pct != null && pct >= 90 ? "text-amber-400" : "text-zinc-400")}>{t.monthlyMinuteLimit ? `${t.monthlyMinuteLimit} (${pct}%)` : "—"}</td>
                    <td className="py-3 pr-3 text-xs text-zinc-400">{ms?.status === "CONNECTED" ? "verbunden" : "—"}</td>
                    <td className="py-3 text-right"><Link href={`/admin/tenants/${t.id}`} className="btn-ghost py-1 text-xs">Öffnen<ArrowRight className="h-3 w-3" /></Link></td>
                  </tr>
                );
              })}
              {data?.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-zinc-500">Noch keine Kunden. Legen Sie den ersten an.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      {create && <CreateTenant templates={ov?.templates ?? []} onClose={() => setCreate(false)} onCreated={reload} />}
    </div>
  );
}

function CreateTenant({ templates, onClose, onCreated }: { templates: { key: string; label: string }[]; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", industry: templates[0]?.key ?? "general", adminEmail: "", adminName: "", phoneNumber: "", monthlyMinuteLimit: "", plan: "STARTER" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; link: string | null } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ tenant: { id: string }; inviteLink: string | null }>("/api/admin/tenants", {
        method: "POST",
        json: { ...f, phoneNumber: f.phoneNumber || undefined, adminName: f.adminName || undefined, monthlyMinuteLimit: f.monthlyMinuteLimit ? Number(f.monthlyMinuteLimit) : null },
      });
      setDone({ id: r.tenant.id, link: r.inviteLink });
      onCreated();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-lg p-5 animate-fadein">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-100">Neuen Kunden anlegen</h3>
          <button className="btn-ghost p-2" onClick={onClose} aria-label="Schließen"><X className="h-4 w-4" /></button>
        </header>
        {done ? (
          <div className="space-y-3 text-sm">
            <p className="text-emerald-400">Kunde angelegt. {done.link ? "Kein E-Mail-Versand eingerichtet – Einladungslink bitte selbst weitergeben:" : "Die Einladung wurde per E-Mail versendet."}</p>
            {done.link && (
              <div className="flex items-center gap-2">
                <code className="block flex-1 truncate rounded bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-300">{done.link}</code>
                <button className="btn-ghost p-1.5" onClick={() => navigator.clipboard.writeText(done.link!)} aria-label="Kopieren"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            )}
            <div className="flex justify-end gap-2"><Link className="btn-primary" href={`/admin/tenants/${done.id}`}>Kunde öffnen</Link></div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-2 gap-2">
            <input className="input col-span-2" required placeholder="Firmenname *" value={f.name} onChange={set("name")} />
            <select className="input col-span-2" value={f.industry} onChange={set("industry")}>{templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
            <input className="input" type="email" required placeholder="E-Mail Admin *" value={f.adminEmail} onChange={set("adminEmail")} />
            <input className="input" placeholder="Name Admin" value={f.adminName} onChange={set("adminName")} />
            <input className="input" placeholder="Twilio-Nummer (+49…)" value={f.phoneNumber} onChange={set("phoneNumber")} />
            <input className="input" type="number" placeholder="Minutenlimit / Monat" value={f.monthlyMinuteLimit} onChange={set("monthlyMinuteLimit")} />
            <input className="input col-span-2" placeholder="Tarif (z. B. STARTER, PRO)" value={f.plan} onChange={set("plan")} />
            {err && <p className="col-span-2 text-xs text-amber-400">{err}</p>}
            <div className="col-span-2 mt-2 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
              <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Anlegen & einladen</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
