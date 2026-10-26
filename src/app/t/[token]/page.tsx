"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Camera, Car, Check, ChevronLeft, Loader2, MapPin, Phone, Plus, RefreshCw, Trash2, Wrench, X } from "lucide-react";

type Material = { description: string; quantity: number; unit: string; unitCents: number };
type Report = { id: string; status: "OPEN" | "EN_ROUTE" | "ON_SITE" | "DONE"; enRouteAt: string | null; arrivedAt: string | null; finishedAt: string | null; findings: string; workDone: string; materials: Material[]; hoursWorked: number; signatureName: string | null; signedAt: string | null; billId: string | null; photos: { id: string }[] };
type Job = { id: string; category: string | null; urgency: string; summary: string | null; notes: string | null; appointmentStart: string | null; appointmentEnd: string | null; status: string; service: { name: string } | null; customer: { name: string | null; companyName: string | null; phone: string; address: string | null; postalCode: string | null }; jobReport: Report | null };
type Data = { employee: { name: string }; tenant: { name: string }; jobs: Job[] };

const STATUS_LABEL = { OPEN: "Geplant", EN_ROUTE: "Unterwegs", ON_SITE: "Vor Ort", DONE: "Erledigt" } as const;
const STATUS_TONE = { OPEN: "bg-zinc-500/15 text-zinc-300", EN_ROUTE: "bg-amber-400/15 text-amber-300", ON_SITE: "bg-cyan-400/15 text-cyan-300", DONE: "bg-emerald-400/15 text-emerald-300" } as const;
const time = (s: string | null) => (s ? new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "");
const dayKey = (s: string | null) => (s ? new Date(s).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }) : "Ohne Termin");
const who = (c: Job["customer"]) => c.companyName || c.name || c.phone;
const addr = (c: Job["customer"]) => [c.address, c.postalCode && !(c.address ?? "").includes(c.postalCode) ? c.postalCode : null].filter(Boolean).join(", ");

/** Techniker-App (PWA): Tagesliste, unterwegs/vor Ort, Befund, Fotos, Material, Unterschrift, Abschluss. Zugang über persönlichen Geräte-Link. */
export default function TechApp({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const base = `/api/public/tech/${token}`;
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(base, { cache: "no-store" });
    if (!r.ok) return setErr(r.status === 404 ? "Dieser Link ist ungültig oder wurde ersetzt. Bitte im Büro einen neuen Link anfordern." : "Gerade keine Verbindung. Bitte gleich noch einmal versuchen.");
    setErr("");
    setData(await r.json());
  }, [base]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (err && !data) return <Shell><p className="p-6 text-sm text-zinc-400">{err}</p></Shell>;
  if (!data) return <Shell><p className="flex items-center gap-2 p-6 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Lade Einsätze …</p></Shell>;
  const job = data.jobs.find((j) => j.id === openId);
  if (job) return <Shell><JobView job={job} base={base} back={() => setOpenId(null)} reload={load} /></Shell>;

  const groups = new Map<string, Job[]>();
  for (const j of data.jobs) groups.set(dayKey(j.appointmentStart), [...(groups.get(dayKey(j.appointmentStart)) ?? []), j]);
  return (
    <Shell>
      <header className="flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div><p className="text-xs text-zinc-500">{data.tenant.name}</p><h1 className="text-lg font-semibold text-zinc-100">Einsätze · {data.employee.name.split(" ")[0]}</h1></div>
        <button className="btn-ghost p-2" onClick={load} aria-label="Aktualisieren"><RefreshCw className="h-4 w-4" /></button>
      </header>
      {err && <p className="mx-4 mb-2 rounded-md bg-amber-400/10 px-3 py-2 text-xs text-amber-300">{err}</p>}
      {data.jobs.length === 0 && <p className="px-4 py-10 text-center text-sm text-zinc-500">Keine Einsätze in den nächsten 7 Tagen.</p>}
      {[...groups.entries()].map(([day, jobs]) => (
        <section key={day} className="mb-4">
          <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{day}</h2>
          <ul className="space-y-2 px-3">
            {jobs.map((j) => {
              const st = j.jobReport?.status ?? "OPEN";
              return (
                <li key={j.id}>
                  <button className="glass w-full p-3 text-left active:scale-[0.99]" onClick={() => setOpenId(j.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-zinc-200">{time(j.appointmentStart)}{j.appointmentEnd ? `–${time(j.appointmentEnd)}` : ""}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span>
                    </div>
                    <div className="mt-1 font-semibold text-zinc-100">{j.service?.name ?? j.category ?? "Einsatz"}{(j.urgency === "CRITICAL" || j.urgency === "HIGH") && <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] text-red-300">dringend</span>}</div>
                    <div className="text-sm text-zinc-400">{who(j.customer)}{addr(j.customer) ? ` · ${addr(j.customer)}` : ""}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>;
}

async function post(url: string, json: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `Fehler ${r.status}`);
  return d;
}

/** Foto im Browser auf max. 1600 px verkleinern und als JPEG hochladen. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Foto konnte nicht gelesen werden."))), "image/jpeg", 0.8));
}

function JobView({ job, base, back, reload }: { job: Job; base: string; back: () => void; reload: () => Promise<void> }) {
  const r = job.jobReport;
  const st = r?.status ?? "OPEN";
  const done = st === "DONE";
  const [findings, setFindings] = useState(r?.findings ?? "");
  const [workDone, setWorkDone] = useState(r?.workDone ?? "");
  const [hours, setHours] = useState(String(r?.hoursWorked ?? 0).replace(".", ","));
  const [materials, setMaterials] = useState<(Omit<Material, "quantity" | "unitCents"> & { qty: string; price: string })[]>(
    (r?.materials ?? []).map((m) => ({ ...m, qty: String(m.quantity).replace(".", ","), price: m.unitCents ? (m.unitCents / 100).toFixed(2).replace(".", ",") : "" })),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [signing, setSigning] = useState(false);
  const url = `${base}/jobs/${job.id}`;
  const num = (s: string) => Number((s || "0").replace(",", "."));

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setMsg(null);
    try { await fn(); await reload(); if (ok) setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }
  const save = () => post(url, { action: "save", findings, workDone, hoursWorked: num(hours), materials: materials.filter((m) => m.description.trim()).map((m) => ({ description: m.description, unit: m.unit || "Stück", quantity: num(m.qty), unitCents: Math.round(num(m.price) * 100) })) });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    await run("photo", async () => {
      for (const f of Array.from(files)) {
        const blob = await shrink(f);
        const res = await fetch(`${url}/photos`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload fehlgeschlagen.");
      }
    }, "Foto gespeichert.");
  }

  return (
    <div className="px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button className="btn-ghost -ml-1 mb-2 px-2" onClick={back}><ChevronLeft className="h-4 w-4" />Alle Einsätze</button>
      <div className="glass space-y-2 p-4">
        <div className="flex items-center justify-between"><span className="font-mono text-sm text-zinc-300">{dayKey(job.appointmentStart)} · {time(job.appointmentStart)}</span><span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span></div>
        <h1 className="text-lg font-semibold text-zinc-100">{job.service?.name ?? job.category ?? "Einsatz"}</h1>
        <p className="text-zinc-300">{who(job.customer)}</p>
        {job.summary && <p className="text-sm text-zinc-400">{job.summary}</p>}
        {job.notes && <p className="rounded-md bg-white/5 p-2 text-xs text-zinc-400">Notiz Büro: {job.notes}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn-ghost" href={`tel:${job.customer.phone}`}><Phone className="h-4 w-4" />Anrufen</a>
          {addr(job.customer) && <a className="btn-ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr(job.customer))}`} target="_blank" rel="noreferrer noopener"><MapPin className="h-4 w-4" />Route</a>}
        </div>
      </div>

      {!done && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className={st === "EN_ROUTE" ? "btn-primary justify-center" : "btn-ghost justify-center border border-zinc-700"} disabled={!!busy} onClick={() => run("st", () => post(url, { action: "status", status: "EN_ROUTE" }))}>{busy === "st" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}Unterwegs</button>
          <button className={st === "ON_SITE" ? "btn-primary justify-center" : "btn-ghost justify-center border border-zinc-700"} disabled={!!busy} onClick={() => run("st2", () => post(url, { action: "status", status: "ON_SITE" }))}>{busy === "st2" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}Vor Ort</button>
        </div>
      )}

      <fieldset disabled={done} className="mt-3 space-y-3">
        <label className="block text-xs text-zinc-400">Befund<textarea className="input mt-1 min-h-[70px]" value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Was war los?" /></label>
        <label className="block text-xs text-zinc-400">Ausgeführte Arbeiten<textarea className="input mt-1 min-h-[70px]" value={workDone} onChange={(e) => setWorkDone(e.target.value)} placeholder="Was wurde gemacht?" /></label>
        <label className="block text-xs text-zinc-400">Arbeitszeit (Stunden)<input className="input mt-1" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
        <div>
          <p className="text-xs text-zinc-400">Material</p>
          {materials.map((m, i) => (
            <div key={i} className="mt-1 grid grid-cols-12 gap-1">
              <input className="input col-span-12" placeholder="z. B. Eckventil ½″" value={m.description} onChange={(e) => setMaterials(materials.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input className="input col-span-3" inputMode="decimal" aria-label="Menge" value={m.qty} onChange={(e) => setMaterials(materials.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <input className="input col-span-3" aria-label="Einheit" value={m.unit} onChange={(e) => setMaterials(materials.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
              <input className="input col-span-5" inputMode="decimal" placeholder="Preis € (opt.)" value={m.price} onChange={(e) => setMaterials(materials.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <button type="button" className="btn-ghost col-span-1 justify-center p-1" aria-label="Entfernen" onClick={() => setMaterials(materials.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </div>
          ))}
          {!done && <button type="button" className="btn-ghost mt-1 text-xs" onClick={() => setMaterials([...materials, { description: "", qty: "1", unit: "Stück", price: "" }])}><Plus className="h-3.5 w-3.5" />Material</button>}
        </div>
        {!done && <button type="button" className="btn-ghost w-full justify-center border border-zinc-700" disabled={!!busy} onClick={() => run("save", save, "Gespeichert.")}>{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Zwischenspeichern</button>}
      </fieldset>

      <div className="mt-4">
        <p className="mb-1 text-xs text-zinc-400">Fotos ({r?.photos.length ?? 0})</p>
        <div className="grid grid-cols-3 gap-2">
          {r?.photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/photos/${p.id}`} alt="Einsatzfoto" className="h-full w-full object-cover" loading="lazy" />
              {!done && <button className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Foto löschen" onClick={() => confirm("Foto löschen?") && run("del", async () => { const x = await fetch(`${url}/photos/${p.id}`, { method: "DELETE" }); if (!x.ok) throw new Error("Löschen fehlgeschlagen."); })}><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
          {!done && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-zinc-600 text-zinc-400">
              {busy === "photo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs"><Camera className="h-5 w-5" />Foto</span>}
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>

      {msg && <p className={`mt-3 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{msg.text}</p>}

      {done ? (
        <div className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-300"><Check className="mr-1 inline h-4 w-4" />Abgeschlossen um {time(r!.finishedAt)}{r!.signatureName ? ` · unterschrieben von ${r!.signatureName}` : ""}{r!.billId ? " · Rechnungsentwurf liegt im Büro" : ""}.</div>
      ) : (
        <button className="btn-primary mt-4 w-full justify-center py-3 text-base" disabled={!!busy} onClick={() => run("pre", save).then(() => setSigning(true))}><Check className="h-5 w-5" />Abschließen</button>
      )}
      {signing && <SignSheet onClose={() => setSigning(false)} onDone={(name, png) => run("finish", () => post(url, { action: "finish", signatureName: name || null, signature: png }), "Einsatz abgeschlossen.").then(() => setSigning(false))} busy={busy === "finish"} />}
    </div>
  );
}

/** Unterschrift des Kunden auf dem Bildschirm (optional, je nach Einstellung Pflicht). */
function SignSheet({ onClose, onDone, busy }: { onClose: () => void; onDone: (name: string, png: string | null) => void; busy: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    let down = false;
    const pos = (e: PointerEvent) => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] as const; };
    const start = (e: PointerEvent) => { down = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e: PointerEvent) => { if (!down) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setDrawn(true); };
    const end = () => { down = false; };
    c.addEventListener("pointerdown", start); c.addEventListener("pointermove", move); c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
    return () => { c.removeEventListener("pointerdown", start); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", end); c.removeEventListener("pointercancel", end); };
  }, []);
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setDrawn(false); };
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
      <div className="glass w-full max-w-xl space-y-3 rounded-b-none p-4 sm:rounded-b-2xl">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-zinc-100">Unterschrift Kunde</h2><button className="btn-ghost p-2" onClick={onClose} aria-label="Schließen"><X className="h-4 w-4" /></button></div>
        <p className="text-xs text-zinc-400">Mit der Unterschrift bestätigt der Kunde die ausgeführten Arbeiten.</p>
        <canvas ref={ref} className="h-44 w-full touch-none rounded-lg bg-white" aria-label="Unterschriftsfeld" />
        <input className="input" placeholder="Name in Druckbuchstaben" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={clear}>Löschen</button>
          <button className="btn-ghost flex-1 justify-center" disabled={busy} onClick={() => onDone("", null)}>Ohne Unterschrift</button>
          <button className="btn-primary flex-1 justify-center" disabled={busy || !drawn || !name.trim()} onClick={() => onDone(name, ref.current!.toDataURL("image/png"))}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Fertig</button>
        </div>
      </div>
    </div>
  );
}
