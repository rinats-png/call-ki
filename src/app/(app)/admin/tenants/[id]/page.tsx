"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Loader2, Trash2, Copy, Download } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, fmtDateTime, TENANT_STATUS_LABEL, TENANT_STATUS_STYLE } from "@/lib/ui";
import { USER_ROLE_LABEL, type UserRole } from "@/lib/constants";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiDownload, apiFetch, useSession } from "@/components/session";

type Detail = {
  id: string; slug: string; name: string; industry: string; status: string; plan: string; monthlyMinuteLimit: number | null; createdAt: string;
  avvVersion: string | null; avvSignedAt: string | null;
  phoneNumbers: { id: string; e164: string; label: string | null; voiceAgentId: string | null; fallbackNumber: string | null }[];
  integrations: { type: string; status: string; lastError: string | null }[];
  users: { id: string; email: string; name: string | null; role: UserRole; disabled: boolean; lastLoginAt: string | null; invitePending: boolean }[];
  auditLogs: { id: string; action: string; createdAt: string }[];
  usage: { calls: number; minutes: number; tickets: number };
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { reload: reloadSession } = useSession();
  const { data, reload } = usePoll<Detail>(`/api/admin/tenants/${id}`, 0);
  const [num, setNum] = useState({ e164: "", label: "", fallbackNumber: "", voiceAgentId: "" });
  const [invite, setInvite] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }
  const [confirmSlug, setConfirmSlug] = useState("");
  const patch = (body: Record<string, unknown>) => run("patch", async () => { await apiFetch(`/api/admin/tenants/${id}`, { method: "PATCH", json: body }); });

  if (!data) return <div className="mx-auto max-w-5xl"><Skeleton className="h-96" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200"><ArrowLeft className="h-3.5 w-3.5" />Alle Mandanten</Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{data.name}</h1>
          <p className="text-sm text-zinc-500">Seit {fmtDateTime(data.createdAt)} · {data.usage.calls} Anrufe, {data.usage.minutes} Min., {data.usage.tickets} Vorgänge diesen Monat</p>
        </div>
        <button className="btn-primary" onClick={() => run("enter", async () => { await apiFetch("/api/admin/switch", { method: "POST", json: { tenantId: id } }); await reloadSession(); router.push("/"); })}>
          <Eye className="h-4 w-4" />Portal öffnen
        </button>
      </header>
      {msg && (
        <div className={cn("rounded-lg border px-3 py-2 text-xs", msg.ok ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300")}>
          {msg.text}
          {msg.link && <div className="mt-1 flex items-center gap-2"><code className="flex-1 truncate font-mono">{msg.link}</code><button className="btn-ghost p-1" onClick={() => navigator.clipboard.writeText(msg.link!)}><Copy className="h-3 w-3" /></button></div>}
        </div>
      )}

      <Panel title="Vertrag & Status">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-xs text-zinc-400">Status</span>
            <select className="input" value={data.status} onChange={(e) => patch({ status: e.target.value })}>
              {Object.entries(TENANT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-zinc-500">Pausiert = Anrufe gehen an die Fallback-Nummer bzw. Mailbox.</span>
          </label>
          <label className="block"><span className="mb-1 block text-xs text-zinc-400">Tarif</span>
            <input className="input" defaultValue={data.plan} onBlur={(e) => e.target.value !== data.plan && patch({ plan: e.target.value })} />
          </label>
          <label className="block"><span className="mb-1 block text-xs text-zinc-400">Minutenlimit / Monat</span>
            <input className="input" type="number" defaultValue={data.monthlyMinuteLimit ?? ""} placeholder="ohne Limit" onBlur={(e) => patch({ monthlyMinuteLimit: e.target.value ? Number(e.target.value) : null })} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-xs text-zinc-400">AVV-Version</span>
            <input className="input" defaultValue={data.avvVersion ?? ""} placeholder="z. B. 2026-10" onBlur={(e) => e.target.value !== (data.avvVersion ?? "") && patch({ avvVersion: e.target.value || null })} />
          </label>
          <label className="block"><span className="mb-1 block text-xs text-zinc-400">AVV abgeschlossen am</span>
            <input className="input" type="date" defaultValue={data.avvSignedAt?.slice(0, 10) ?? ""} onBlur={(e) => e.target.value !== (data.avvSignedAt?.slice(0, 10) ?? "") && patch({ avvSignedAt: e.target.value || null })} />
          </label>
          <p className="self-end text-[11px] text-zinc-500">Ohne Auftragsverarbeitungsvertrag lässt sich der Mandant nicht aktivieren (Vorlage: docs/recht/avv-vorlage.md).</p>
        </div>
        <p className="mt-2 text-xs"><span className={cn("chip", TENANT_STATUS_STYLE[data.status])}>{TENANT_STATUS_LABEL[data.status]}</span>{(!data.avvVersion || !data.avvSignedAt) && <span className="ml-2 text-amber-400">AVV fehlt</span>}</p>
      </Panel>

      <Panel title="Rufnummern">
        <ul className="mb-3 space-y-2">
          {data.phoneNumbers.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm">
              <span className="font-mono text-zinc-100">{n.e164}</span>
              <span className="flex-1 text-xs text-zinc-500">{[n.label, n.fallbackNumber && `Fallback ${n.fallbackNumber}`, n.voiceAgentId && `Agent ${n.voiceAgentId}`].filter(Boolean).join(" · ")}</span>
              <button className="btn-ghost p-1.5" aria-label="Entfernen" onClick={() => run("rm", async () => { if (!confirm(`Nummer ${n.e164} entfernen?`)) return; await apiFetch(`/api/admin/tenants/${id}/numbers?e164=${encodeURIComponent(n.e164)}`, { method: "DELETE" }); })}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
          {data.phoneNumbers.length === 0 && <li className="text-sm text-amber-400">Noch keine Nummer – ohne Nummer erreicht kein Anruf diesen Kunden.</li>}
        </ul>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run("num", async () => { await apiFetch(`/api/admin/tenants/${id}/numbers`, { method: "POST", json: num }); setNum({ e164: "", label: "", fallbackNumber: "", voiceAgentId: "" }); }); }}>
          <input className="input" required placeholder="Twilio-Nummer +49…" value={num.e164} onChange={(e) => setNum({ ...num, e164: e.target.value })} />
          <input className="input" placeholder="Bezeichnung" value={num.label} onChange={(e) => setNum({ ...num, label: e.target.value })} />
          <input className="input" placeholder="Fallback-Nummer" value={num.fallbackNumber} onChange={(e) => setNum({ ...num, fallbackNumber: e.target.value })} />
          <input className="input" placeholder="Eigener Retell-Agent (optional)" value={num.voiceAgentId} onChange={(e) => setNum({ ...num, voiceAgentId: e.target.value })} />
          <button className="btn-primary sm:col-span-4 sm:justify-self-end" disabled={busy === "num"}>{busy === "num" && <Loader2 className="h-4 w-4 animate-spin" />}Nummer zuordnen</button>
        </form>
      </Panel>

      <Panel title="Zugänge">
        <ul className="divide-y divide-zinc-800">
          {data.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1"><div className="text-zinc-100">{u.name ?? u.email}</div><div className="text-xs text-zinc-500">{u.email} · {USER_ROLE_LABEL[u.role]} · {u.invitePending ? "Einladung offen" : u.lastLoginAt ? `zuletzt ${fmtDateTime(u.lastLoginAt)}` : "nie angemeldet"}</div></div>
              <button className="btn-ghost py-1 text-xs" onClick={() => run("link", async () => { const r = await apiFetch<{ link: string | null }>(`/api/admin/tenants/${id}/users`, { method: "POST", json: { userId: u.id } }); setMsg({ ok: true, text: r.link ? "Zugangslink:" : "E-Mail versendet.", link: r.link ?? undefined }); })}>Zugangslink</button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); run("inv", async () => { const r = await apiFetch<{ link: string | null }>(`/api/admin/tenants/${id}/users`, { method: "POST", json: { email: invite } }); setInvite(""); setMsg({ ok: true, text: r.link ? "Einladungslink:" : "Einladung versendet.", link: r.link ?? undefined }); }); }}>
          <input className="input flex-1" type="email" required placeholder="Weiteren Admin einladen (E-Mail)" value={invite} onChange={(e) => setInvite(e.target.value)} />
          <button className="btn-ghost" disabled={busy === "inv"}>Einladen</button>
        </form>
      </Panel>

      <Panel title="Integrationen & Verlauf">
        <p className="mb-3 text-sm text-zinc-400">Microsoft 365: {data.integrations.find((i) => i.type === "MICROSOFT_365")?.status ?? "nicht verbunden"}</p>
        <ul className="space-y-1 text-xs text-zinc-500">
          {data.auditLogs.map((l) => <li key={l.id}>{fmtDateTime(l.createdAt)} · {l.action}</li>)}
        </ul>
      </Panel>

      <Panel title="Vertragsende">
        <p className="mb-3 text-sm text-zinc-400">
          Gesamtexport aller Daten (JSON) und endgültige Löschung – auch bei Retell und Twilio. Backups laufen nach 14 Tagen aus.
          Zum Löschen den Mandanten zuerst pausieren und die Kennung <code className="font-mono text-zinc-200">{data.slug}</code> eingeben.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => run("export", () => apiDownload(`/api/admin/tenants/${id}/export`, `export-${data.slug}.json`))}>
            <Download className="h-4 w-4" />Gesamtexport
          </button>
          <input className="input max-w-[220px]" placeholder={data.slug} value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} />
          <button
            className="btn-ghost text-rose-400"
            disabled={data.status !== "PAUSED" || confirmSlug !== data.slug || busy === "delete"}
            onClick={async () => {
              if (!confirm(`„${data.name}“ mit allen Daten endgültig löschen? Das kann nicht rückgängig gemacht werden.`)) return;
              setBusy("delete");
              setMsg(null);
              try {
                const del = (force: boolean) => apiFetch(`/api/admin/tenants/${id}`, { method: "DELETE", json: { confirmSlug, force } });
                try {
                  await del(false);
                } catch (e) {
                  if ((e as { code?: string }).code !== "PROVIDER_INCOMPLETE" || !confirm(`${(e as Error).message}\n\nTrotzdem löschen?`)) throw e;
                  await del(true);
                }
                router.push("/admin");
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message });
                setBusy(null);
              }
            }}
          >
            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Endgültig löschen
          </button>
        </div>
      </Panel>
    </div>
  );
}
