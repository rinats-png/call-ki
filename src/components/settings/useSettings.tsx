"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import type { TenantSettings } from "@/lib/tenant/settings";
import { apiFetch, useSession } from "../session";
import { InfoTip } from "@/components/InfoTip";

export type SettingsPayload = {
  tenant: { id: string; name: string; industry: string; timezone: string; logoUrl: string | null; status: string };
  settings: TenantSettings;
  template: { key: string; label: string; categories: string[]; urgency: { critical: string[]; high: string[]; low: string[] } };
  templates: { key: string; label: string; description: string }[];
  numbers: { e164: string; label: string | null; fallbackNumber: string | null }[];
};

/** Lädt/speichert Mandanten-Einstellungen; Formulare arbeiten auf einer lokalen Kopie. */
export function useSettings() {
  const { reload: reloadSession, isTenantAdmin } = useSession();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [draft, setDraft] = useState<{ tenant: SettingsPayload["tenant"]; settings: TenantSettings } | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");

  const load = useCallback(async () => {
    const d = await apiFetch<SettingsPayload>("/api/settings");
    setData(d);
    setDraft({ tenant: d.tenant, settings: d.settings });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!draft) return;
    setState("saving");
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        json: { name: draft.tenant.name, industry: draft.tenant.industry, timezone: draft.tenant.timezone, logoUrl: draft.tenant.logoUrl ?? "", settings: draft.settings },
      });
      await load();
      await reloadSession();
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  }

  const setS = <K extends keyof TenantSettings>(k: K, v: TenantSettings[K]) => draft && setDraft({ ...draft, settings: { ...draft.settings, [k]: v } });
  const setT = <K extends keyof SettingsPayload["tenant"]>(k: K, v: SettingsPayload["tenant"][K]) => draft && setDraft({ ...draft, tenant: { ...draft.tenant, [k]: v } });
  const dirty = !!data && !!draft && JSON.stringify({ tenant: data.tenant, settings: data.settings }) !== JSON.stringify(draft);

  return { data, draft, setS, setT, save, state, dirty, readOnly: !isTenantAdmin };
}

export function SaveBar({ save, state, dirty, readOnly }: Pick<ReturnType<typeof useSettings>, "save" | "state" | "dirty" | "readOnly">) {
  if (readOnly) return null;
  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3">
      {typeof state === "object" && <span className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-amber-400">{state.error}</span>}
      {state === "saved" && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" />Gespeichert</span>}
      <button className="btn-primary shadow-lg" onClick={save} disabled={!dirty || state === "saving"}>
        {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}Änderungen speichern
      </button>
    </div>
  );
}

export function Field({ label, hint, help, children }: { label: string; hint?: React.ReactNode; help?: string[]; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-zinc-400">{label}{help && <InfoTip title={label} steps={help} />}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-zinc-500">{hint}</span>}
    </label>
  );
}

/** Kommagetrennte Liste ↔ Array */
export function ListInput({ value, onChange, placeholder, disabled }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <input
      className="input"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}
