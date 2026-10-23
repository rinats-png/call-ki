"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, KeyRound, Loader2, PlugZap, RefreshCw, Save } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { PageHero } from "@/components/PageHero";
import { InfoTip } from "@/components/InfoTip";
import { apiFetch } from "@/components/session";
import { CATEGORY_LABEL, LEVEL_LABEL, PROVIDERS, type Category, type Provider, type ProviderField } from "@/lib/platform/registry";
import { WEBHOOK_LABEL } from "@/lib/platform/webhooks-labels";

type SettingState = { key: string; set: boolean; source: "ui" | "env" | null; value?: string; hint?: string };
type Payload = { settings: Record<string, SettingState>; webhooks: Record<string, string>; encryption: boolean };

const CATEGORIES: Category[] = ["general", "voice", "telephony", "calendar", "email"];

function isConfigured(p: Provider, s: Payload["settings"]) {
  const req = p.fields.filter((f) => f.required);
  return req.length > 0 && req.every((f) => s[f.key]?.set);
}

export default function Page() {
  const { data, reload } = usePoll<Payload>("/api/admin/settings", 0);
  const [cat, setCat] = useState<Category>("voice");
  const [sel, setSel] = useState<Record<string, string>>({});
  if (!data) return <div className="mx-auto max-w-[1500px]"><Skeleton className="h-96 rounded-3xl" /></div>;
  const providers = PROVIDERS.filter((p) => p.category === cat);
  const needs = (c?: Category) => PROVIDERS.filter((p) => (!c || p.category === c) && p.fields.some((f) => f.required));
  const doneOf = (c?: Category) => needs(c).filter((p) => isConfigured(p, data.settings)).length;
  const current = providers.find((p) => p.id === sel[cat]) ?? providers.find((p) => isConfigured(p, data.settings)) ?? providers[0];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHero
        eyebrow="Gelten für alle Kunden · Geheimnisse werden verschlüsselt gespeichert"
        title="Plattform & Verbindungen"
        value={doneOf()}
        valueLabel={`von ${needs().length} Anbietern eingerichtet`}
        stats={(["voice", "telephony", "email"] as Category[]).map((c) => ({ label: CATEGORY_LABEL[c].title, value: `${doneOf(c)}/${needs(c).length}` }))}
      />
      {!data.encryption && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mr-1 inline h-4 w-4" />APP_ENCRYPTION_KEY ist auf dem Server nicht gesetzt – Zugangsdaten können erst gespeichert werden, wenn er gesetzt ist.
        </div>
      )}

      <nav className="glass flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1" aria-label="Bereiche">
        {CATEGORIES.map((c) => {
          const total = needs(c).length;
          return (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={cn("nav-item py-2", cat === c && "nav-item-active")}>
              {CATEGORY_LABEL[c].title}
              {total > 0 && <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", cat === c ? "bg-white/20" : "bg-zinc-800 text-zinc-400")}>{doneOf(c)}/{total}</span>}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="glass space-y-1 p-3 lg:sticky lg:top-20">
          <p className="px-2 pb-2 pt-1 text-xs leading-relaxed text-zinc-500">{CATEGORY_LABEL[cat].description}</p>
          {providers.map((p) => {
            const on = p.id === current?.id;
            const req = p.fields.some((f) => f.required);
            const ok = isConfigured(p, data.settings);
            return (
              <button key={p.id} type="button" onClick={() => setSel((v) => ({ ...v, [cat]: p.id }))} aria-current={on ? "true" : undefined}
                className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition", on ? "rail-item-active" : "text-zinc-200 hover:bg-zinc-950/70")}>
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", !req ? "bg-zinc-600" : ok ? "bg-emerald-400" : "bg-amber-400")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className={cn("block truncate text-xs", on ? "opacity-75" : "text-zinc-500")}>{!req ? LEVEL_LABEL[p.level] : ok ? "eingerichtet" : "nicht eingerichtet"}</span>
                </span>
              </button>
            );
          })}
        </aside>
        <div className="min-w-0">{current && <ProviderCard key={current.id} provider={current} data={data} onSaved={reload} />}</div>
      </div>
    </div>
  );
}

function ProviderCard({ provider: p, data, onSaved }: { provider: Provider; data: Payload; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const configured = isConfigured(p, data.settings);
  const dirty = useMemo(() => Object.keys(draft).length > 0, [draft]);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      for (const [key, value] of Object.entries(draft)) await apiFetch("/api/admin/settings", { method: "PUT", json: { key, value } });
      setDraft({});
      setMsg({ ok: true, text: "Gespeichert." });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }
  async function remove(key: string) {
    if (!confirm("Diesen Wert aus der Oberfläche entfernen? (Ein Wert aus der .env bleibt wirksam.)")) return;
    setBusy(key);
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", json: { key, value: null } });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }
  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      const r = await apiFetch<{ ok: boolean; message: string }>("/api/admin/settings/test", { method: "POST", json: { provider: p.id } });
      setMsg({ ok: r.ok, text: r.message });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }

  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-2">
          {p.name}
          <InfoTip title={`${p.name} einrichten`} steps={p.setup} link={p.docs ? { href: p.docs, label: "Anbieter-Dokumentation" } : undefined} />
          <span className="chip border-zinc-700 text-[10px] text-zinc-400">{LEVEL_LABEL[p.level]}</span>
          {p.fields.some((f) => f.required) && (configured
            ? <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><CheckCircle2 className="h-3 w-3" />eingerichtet</span>
            : <span className="chip border-amber-500/40 bg-amber-500/15 text-amber-300"><AlertTriangle className="h-3 w-3" />nicht eingerichtet</span>)}
        </span>
      }
      action={p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-300">Website <ExternalLink className="h-3 w-3" /></a> : undefined}
    >
      <p className="mb-3 text-sm text-zinc-400">{p.tagline}</p>

      {p.fields.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.fields.map((f) => (
            <FieldInput key={f.key} field={f} state={data.settings[f.key]} value={draft[f.key]} busy={busy === f.key} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} onRemove={() => remove(f.key)} />
          ))}
        </div>
      )}

      {p.level === "info" && p.fields.length === 0 && (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-300">{p.setup.map((s, i) => <li key={i}>{s}</li>)}</ol>
      )}

      {p.webhooks && p.webhooks.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-zinc-400">Beim Anbieter einzutragen</div>
          {p.webhooks.map((k) => (
            <div key={k} className="glass-soft flex items-center gap-2 p-2 pl-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-zinc-500">{WEBHOOK_LABEL[k] ?? k}</div>
                <code className="block truncate font-mono text-xs text-cyan-300">{data.webhooks[k]}</code>
              </div>
              <button type="button" className="btn-ghost p-2" aria-label="Kopieren" onClick={() => { navigator.clipboard.writeText(data.webhooks[k]); setCopied(k); setTimeout(() => setCopied(null), 1500); }}>
                {copied === k ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {(p.fields.length > 0 || p.testable) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {p.fields.length > 0 && (
            <button className="btn-primary" disabled={!dirty || busy === "save"} onClick={save}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Speichern
            </button>
          )}
          {p.testable && (
            <button className="btn-ghost" disabled={busy === "test" || dirty} title={dirty ? "Erst speichern" : undefined} onClick={test}>
              {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}Verbindung testen
            </button>
          )}
          {msg && <span className={cn("text-xs", msg.ok ? "text-emerald-300" : "text-amber-300")}>{msg.text}</span>}
        </div>
      )}
    </Panel>
  );
}

function FieldInput({ field: f, state, value, busy, onChange, onRemove }: { field: ProviderField; state?: SettingState; value?: string; busy: boolean; onChange: (v: string) => void; onRemove: () => void }) {
  const secret = f.type === "secret" || f.type === "generate";
  const current = secret ? "" : (state?.value ?? "");
  const shown = value ?? current;
  const sourceNote = state?.source === "env" ? "aus .env" : state?.source === "ui" ? "in Oberfläche gespeichert" : null;

  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-zinc-400">
        {f.label}{f.required && <span className="text-amber-400">*</span>}
        {f.help && <InfoTip title={f.label} steps={f.help} />}
        {sourceNote && <span className="ml-auto text-[10px] font-normal text-zinc-500">{sourceNote}</span>}
      </span>
      <span className="flex gap-2">
        {f.type === "select" ? (
          <select className="input" value={shown} onChange={(e) => onChange(e.target.value)}>
            <option value="">– bitte wählen –</option>
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            className="input font-mono text-[13px]"
            type={secret ? "password" : f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
            autoComplete="off"
            spellCheck={false}
            value={shown}
            placeholder={secret && state?.set ? `${state.hint} – zum Ändern neu eingeben` : f.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {f.type === "generate" && (
          <button type="button" className="btn-ghost shrink-0" title="Zufälligen Wert erzeugen" onClick={() => onChange(randomHex(32))}>
            <RefreshCw className="h-4 w-4" />Erzeugen
          </button>
        )}
        {state?.source === "ui" && (
          <button type="button" className="btn-ghost shrink-0 p-2" aria-label="Wert entfernen" title="Wert entfernen" disabled={busy} onClick={onRemove}>
            <KeyRound className="h-4 w-4" />
          </button>
        )}
      </span>
      {f.type === "generate" && value && <span className="mt-1 block break-all font-mono text-[11px] text-cyan-300">Neuer Wert (jetzt kopieren, wird nach dem Speichern nicht mehr angezeigt): {value}</span>}
      {f.hint && <span className="mt-1 block text-[11px] leading-relaxed text-zinc-500">{f.hint}</span>}
    </label>
  );
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
