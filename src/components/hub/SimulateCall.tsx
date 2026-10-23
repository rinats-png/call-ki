"use client";

import { useState } from "react";
import { X, Loader2, PhoneCall } from "lucide-react";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { apiFetch, useSession } from "../session";

/** Manuelle Erfassung – durchläuft denselben Ablauf wie die Sprach-KI (Routing, Termin, Benachrichtigungen). */
export function SimulateCall({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { me } = useSession();
  const t = me?.tenant;
  const [f, setF] = useState({
    phone: "", name: "", companyName: "", email: "", address: "", postalCode: "",
    customerType: "PRIVATE", category: t?.categories[0] ?? "", description: "", appointmentStart: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) if (v) payload[k] = v;
    if (payload.appointmentStart) payload.appointmentStart = new Date(payload.appointmentStart).toISOString();
    try {
      const j = await apiFetch<{ ticket: { id: string }; slotTaken: boolean }>("/api/tickets", { method: "POST", json: payload });
      if (j.slotTaken) setErr("Termin war belegt – Vorgang wurde ohne Termin angelegt.");
      onCreated(j.ticket.id);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 !m-0 grid place-items-center p-4">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="glass relative max-h-[92vh] w-full max-w-lg overflow-y-auto p-5 animate-fadein">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-100"><PhoneCall className="h-4 w-4 text-cyan-300" />Anruf erfassen</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Schließen"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid grid-cols-2 gap-2">
          <input className="input col-span-2 sm:col-span-1" placeholder="Telefon *" required value={f.phone} onChange={set("phone")} />
          <select className="input col-span-2 sm:col-span-1" value={f.customerType} onChange={set("customerType")}>
            {CUSTOMER_TYPES.map((c) => <option key={c} value={c}>{t?.customerTypeLabels[c] ?? c}</option>)}
          </select>
          <input className="input" placeholder="Name" value={f.name} onChange={set("name")} />
          <input className="input" placeholder="Firma" value={f.companyName} onChange={set("companyName")} />
          <input className="input col-span-2" placeholder="E-Mail" type="email" value={f.email} onChange={set("email")} />
          <input className="input" placeholder="Straße, Ort" value={f.address} onChange={set("address")} />
          <input className="input" placeholder="PLZ" inputMode="numeric" maxLength={5} value={f.postalCode} onChange={set("postalCode")} />
          <select className="input" value={f.category} onChange={set("category")}>
            {t?.categories.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input className="input" type="datetime-local" value={f.appointmentStart} onChange={set("appointmentStart")} title="Optionaler Termin" />
          <textarea className="input col-span-2 min-h-[84px]" placeholder="Beschreibung des Anliegens *" required value={f.description} onChange={set("description")} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Zuständigkeit, Dringlichkeit und Benachrichtigungen werden automatisch wie bei einem KI-Anruf ermittelt.</p>
        {err && <p className="mt-2 text-xs text-amber-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Vorgang anlegen</button>
        </div>
      </form>
    </div>
  );
}
