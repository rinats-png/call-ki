"use client";

import { use, useEffect, useRef, useState } from "react";
import { CalendarCheck, ChevronLeft, Loader2, Phone } from "lucide-react";

type Info = { name: string; headline: string; intro: string; requireEmail: boolean; phone: string | null; privacyUrl: string | null; services: { id: string; name: string; durationMin: number }[] };
type Slot = { start: string; label: string };
type Step = "service" | "where" | "when" | "who" | "done";

const C = { accent: "#0f766e", soft: "#e6f2f0", text: "#1f2530", muted: "#5b6472", border: "#d9dee5" };

/** Öffentliche Online-Terminbuchung je Betrieb: Leistung → Ort → Termin → Kontaktdaten. */
export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const api = `/api/public/booking/${slug}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotMsg, setSlotMsg] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "", consent: false, website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string; label: string; emailConfirmation: boolean } | null>(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    fetch(api).then(async (r) => (r.ok ? setInfo(await r.json()) : setErr((await r.json().catch(() => ({}))).error ?? "Diese Buchungsseite ist nicht verfügbar.")));
  }, [api]);

  async function post<T>(body: unknown): Promise<T> {
    const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const fields = d?.details?.fieldErrors ? Object.values(d.details.fieldErrors as Record<string, string[]>).flat()[0] : null;
      throw new Error(fields ?? d.error ?? "Das hat nicht geklappt. Bitte versuchen Sie es erneut.");
    }
    return d as T;
  }
  async function loadSlots() {
    setBusy(true); setErr(null);
    try {
      const r = await post<{ slots: Slot[]; message: string | null }>({ action: "slots", serviceId, postalCode, address });
      setSlots(r.slots); setSlotMsg(r.message); setStep("when");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    setBusy(true); setErr(null);
    try {
      const r = await post<{ ok: true; reference: string; label: string; emailConfirmation: boolean } | { ok: false; slots: Slot[]; message: string }>({ action: "book", serviceId, start: slot.start, address, postalCode, ...form, openedAt: openedAt.current });
      if (r.ok) { setDone(r); setStep("done"); }
      else { setSlots(r.slots); setSlot(null); setSlotMsg(r.message); setStep("when"); }
    } catch (e2) { setErr((e2 as Error).message); }
    setBusy(false);
  }

  const btn = { background: C.accent, color: "#fff" };
  const input = "w-full rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:ring-2";
  if (!info) return <main className="grid min-h-screen place-items-center bg-white p-6 text-sm" style={{ color: C.muted }}>{err ?? <Loader2 className="h-5 w-5 animate-spin" />}</main>;
  const service = info.services.find((s) => s.id === serviceId);

  return (
    <main className="min-h-screen bg-[#f6f8fa] px-4 py-6 sm:py-10" style={{ color: C.text }}>
      <div className="mx-auto max-w-lg">
        <header className="mb-5">
          <p className="text-sm font-semibold" style={{ color: C.accent }}>{info.name}</p>
          <h1 className="text-2xl font-bold leading-tight">{info.headline}</h1>
          {info.intro && <p className="mt-2 text-[15px]" style={{ color: C.muted }}>{info.intro}</p>}
        </header>

        <section className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: C.border }}>
          {step !== "service" && step !== "done" && <button className="mb-3 inline-flex items-center gap-1 text-sm" style={{ color: C.muted }} onClick={() => { setErr(null); setStep(step === "where" ? "service" : step === "when" ? "where" : "when"); }}><ChevronLeft className="h-4 w-4" />Zurück</button>}

          {step === "service" && (
            <div className="space-y-2">
              <h2 className="mb-2 font-semibold">1. Worum geht es?</h2>
              {info.services.length === 0 && <p className="text-sm" style={{ color: C.muted }}>Online sind gerade keine Leistungen buchbar.</p>}
              {info.services.map((s) => (
                <button key={s.id} onClick={() => { setServiceId(s.id); setStep("where"); }} className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left hover:shadow-sm" style={{ borderColor: serviceId === s.id ? C.accent : C.border }}>
                  <span className="font-medium">{s.name}</span><span className="text-sm" style={{ color: C.muted }}>ca. {s.durationMin} Min.</span>
                </button>
              ))}
            </div>
          )}

          {step === "where" && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); loadSlots(); }}>
              <h2 className="font-semibold">2. Wo sollen wir hinkommen?</h2>
              <label className="block text-sm">Straße und Hausnummer<input className={input} style={{ borderColor: C.border }} required value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" /></label>
              <label className="block text-sm">Postleitzahl<input className={input} style={{ borderColor: C.border }} required inputMode="numeric" pattern="\d{4,5}" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} autoComplete="postal-code" /></label>
              <button className="w-full rounded-xl py-3 font-semibold" style={btn} disabled={busy}>{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Freie Termine anzeigen"}</button>
            </form>
          )}

          {step === "when" && (
            <div className="space-y-2">
              <h2 className="font-semibold">3. Termin wählen</h2>
              <p className="text-sm" style={{ color: C.muted }}>{service?.name} · {address}, {postalCode}</p>
              {slotMsg && <p className="rounded-lg p-3 text-sm" style={{ background: "#fff7e6", color: "#8a5a00" }}>{slotMsg}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {slots?.map((s) => (
                  <button key={s.start} onClick={() => { setSlot(s); setStep("who"); }} className="rounded-xl border px-3 py-3 text-left text-[15px] font-medium hover:shadow-sm" style={{ borderColor: C.border }}>{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {step === "who" && slot && (
            <form className="space-y-3" onSubmit={book}>
              <h2 className="font-semibold">4. Ihre Kontaktdaten</h2>
              <p className="rounded-lg p-3 text-sm font-medium" style={{ background: C.soft, color: C.accent }}>{service?.name} am {slot.label}</p>
              <label className="block text-sm">Name<input className={input} style={{ borderColor: C.border }} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
              <label className="block text-sm">Telefon (für Rückfragen)<input className={input} style={{ borderColor: C.border }} required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
              <label className="block text-sm">E-Mail{info.requireEmail ? "" : " (optional)"}<input className={input} style={{ borderColor: C.border }} required={info.requireEmail} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
              <label className="block text-sm">Was ist los? (optional)<textarea className={`${input} min-h-[80px]`} style={{ borderColor: C.border }} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <label className="flex items-start gap-2 text-sm" style={{ color: C.muted }}>
                <input type="checkbox" className="mt-1" required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                <span>Ich bin einverstanden, dass {info.name} meine Angaben zur Terminvereinbarung und Durchführung des Auftrags verarbeitet.{info.privacyUrl && <> <a className="underline" href={info.privacyUrl} target="_blank" rel="noreferrer">Datenschutzhinweise</a></>}</span>
              </label>
              <button className="w-full rounded-xl py-3 font-semibold" style={btn} disabled={busy}>{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Verbindlich buchen"}</button>
            </form>
          )}

          {step === "done" && done && (
            <div className="space-y-3 py-4 text-center">
              <CalendarCheck className="mx-auto h-10 w-10" style={{ color: C.accent }} />
              <h2 className="text-xl font-bold">Termin gebucht</h2>
              <p className="text-[15px]">{service?.name} am <b>{done.label}</b></p>
              <p className="text-sm" style={{ color: C.muted }}>{done.emailConfirmation ? "Sie bekommen gleich eine Bestätigung per E-Mail." : "Wir melden uns, falls es Rückfragen gibt."} Vorgangsnummer {done.reference}</p>
            </div>
          )}

          {err && <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: "#fdecec", color: "#b42318" }}>{err}</p>}
        </section>

        {info.phone && <p className="mt-4 text-center text-sm" style={{ color: C.muted }}><Phone className="mr-1 inline h-4 w-4 align-[-3px]" />Notfall oder Fragen? <a className="whitespace-nowrap font-semibold" style={{ color: C.accent }} href={`tel:${info.phone.replace(/\s/g, "")}`}>{info.phone}</a> – auch nachts erreichbar.</p>}
      </div>
    </main>
  );
}
