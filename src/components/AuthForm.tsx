"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export type Field = { name: string; label: string; type?: string; autoComplete?: string; required?: boolean; defaultValue?: string; hint?: string };

/** Schlankes Formular für die Anmeldeseiten. */
export function AuthForm({ title, subtitle, fields, submitLabel, onSubmit, footer }: {
  title: string;
  subtitle?: React.ReactNode;
  fields: Field[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<string | void>;
  footer?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    try {
      const msg = await onSubmit(values);
      if (msg) setInfo(msg);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="mb-2">
        <h1 className="text-lg font-semibold text-zinc-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-400">{f.label}</span>
          <input className="input" name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required={f.required ?? true} defaultValue={f.defaultValue} />
          {f.hint && <span className="mt-1 block text-[11px] text-zinc-500">{f.hint}</span>}
        </label>
      ))}
      {error && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{error}</p>}
      {info && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{info}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</button>
      {footer && <div className="pt-1 text-center text-xs text-zinc-500">{footer}</div>}
    </form>
  );
}
