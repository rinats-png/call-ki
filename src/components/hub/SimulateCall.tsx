"use client";

import { useState } from "react";
import { X, Loader2, PhoneCall } from "lucide-react";
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL, PEST_TYPES } from "@/lib/constants";

/** Manuelle Erfassung bzw. Testanruf – durchläuft denselben Workflow wie die Sprach-KI. */
export function SimulateCall({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({
    phone: "", name: "", companyName: "", email: "", address: "", postalCode: "",
    customerType: "PRIVATE", pestType: "Wespen", description: "", appointmentStart: "",
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
    const r = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(typeof j.error === "string" ? j.error : "Bitte Eingaben prüfen (Telefon & Beschreibung sind Pflicht).");
      return;
    }
    onCreated(j.ticket.id);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="glass relative w-full max-w-lg p-5 animate-fadein">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-100"><PhoneCall className="h-4 w-4 text-cyan-300" />Anruf erfassen / simulieren</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-2"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid grid-cols-2 gap-2">
          <input className="input col-span-2 sm:col-span-1" placeholder="Telefon *" required value={f.phone} onChange={set("phone")} />
          <select className="input col-span-2 sm:col-span-1" value={f.customerType} onChange={set("customerType")}>
            {CUSTOMER_TYPES.map((c) => <option key={c} value={c}>{CUSTOMER_TYPE_LABEL[c]}</option>)}
          </select>
          <input className="input" placeholder="Name" value={f.name} onChange={set("name")} />
          <input className="input" placeholder="Firma" value={f.companyName} onChange={set("companyName")} />
          <input className="input col-span-2" placeholder="E-Mail" type="email" value={f.email} onChange={set("email")} />
          <input className="input" placeholder="Straße, Ort" value={f.address} onChange={set("address")} />
          <input className="input" placeholder="PLZ" inputMode="numeric" maxLength={5} value={f.postalCode} onChange={set("postalCode")} />
          <select className="input" value={f.pestType} onChange={set("pestType")}>
            {PEST_TYPES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input className="input" type="datetime-local" value={f.appointmentStart} onChange={set("appointmentStart")} title="Optionaler Termin" />
          <textarea className="input col-span-2 min-h-[84px]" placeholder="Beschreibung des Anliegens *" required value={f.description} onChange={set("description")} />
        </div>
        {err && <p className="mt-2 text-xs text-amber-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Ticket anlegen</button>
        </div>
      </form>
    </div>
  );
}
