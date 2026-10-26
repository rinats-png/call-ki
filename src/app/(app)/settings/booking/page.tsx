"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { Field, SaveBar, useSettings } from "@/components/settings/useSettings";
import { ModuleGate } from "@/components/ModuleGate";
import { useSession } from "@/components/session";

/** Online-Terminbuchung: Seite einschalten, Texte, buchbare Leistungen, Link/QR/Website-Baustein */
export default function Page() {
  return <ModuleGate module="booking_page"><BookingSettings /></ModuleGate>;
}

function BookingSettings() {
  const s = useSettings();
  const { me } = useSession();
  const { data: cat } = usePoll<{ services: { id: string; name: string; active: boolean }[] }>("/api/services", 60_000);
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const url = me?.tenant ? `${origin}/buchen/${me.tenant.slug}` : "";
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => { if (url) QRCode.toDataURL(url, { margin: 1, width: 320 }).then(setQr); }, [url]);
  const { data, draft, setS, readOnly } = s;
  if (!data || !draft) return <Skeleton className="h-96" />;
  const b = draft.settings.bookingPage;
  const set = (patch: Partial<typeof b>) => setS("bookingPage", { ...b, ...patch });
  const active = cat?.services.filter((x) => x.active) ?? [];
  const snippet = `<a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0f766e;color:#fff;font-weight:600;text-decoration:none">Termin online buchen</a>`;
  const copy = (t: string, k: string) => navigator.clipboard.writeText(t).then(() => setCopied(k));

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <Panel title="Buchungsseite">
        <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={b.enabled} onChange={(e) => set({ enabled: e.target.checked })} />Online-Buchung ist eingeschaltet</label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Überschrift (optional)"><input className="input" value={b.headline} onChange={(e) => set({ headline: e.target.value })} placeholder={`Termin bei ${me?.tenant?.name ?? "uns"} buchen`} /></Field>
          <label className="flex items-center gap-2 self-end text-sm text-zinc-300"><input type="checkbox" checked={b.requireEmail} onChange={(e) => set({ requireEmail: e.target.checked })} />E-Mail-Adresse ist Pflicht (für die Bestätigung)</label>
          <div className="sm:col-span-2"><Field label="Begrüßungstext (optional)"><textarea className="input min-h-[60px]" value={b.intro} onChange={(e) => set({ intro: e.target.value })} placeholder="Wählen Sie Leistung und Wunschtermin – wir bestätigen sofort." /></Field></div>
        </div>
      </Panel>
      <Panel title="Buchbare Leistungen">
        {active.length === 0 ? <p className="text-sm text-zinc-500">Zuerst unter Einstellungen → Leistungen Leistungen anlegen. Online buchbar sind nur Leistungen aus dem Katalog.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="text-xs text-zinc-500 sm:col-span-2">Keine Auswahl = alle aktiven Leistungen. Notfälle werden online nie eingeplant – die Seite verweist dann auf Ihre Telefonnummer.</p>
            {active.map((x) => (
              <label key={x.id} className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={b.serviceIds.includes(x.id)} onChange={(e) => set({ serviceIds: e.target.checked ? [...b.serviceIds, x.id] : b.serviceIds.filter((i) => i !== x.id) })} />{x.name}</label>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Link teilen">
        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <div className="space-y-3">
            <div className="flex gap-2"><input className="input font-mono text-xs" readOnly value={url} onFocus={(e) => e.target.select()} /><button type="button" className="btn-ghost" onClick={() => copy(url, "url")}><Copy className="h-4 w-4" />{copied === "url" ? "Kopiert" : "Kopieren"}</button><a className="btn-ghost" href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></div>
            <p className="text-xs text-zinc-500">Für Website, Google-Unternehmensprofil („Termin buchen“-Link), E-Mail-Signatur und Social Media.</p>
            <Field label="Knopf für Ihre Website"><textarea className="input min-h-[70px] font-mono text-[11px]" readOnly value={snippet} onFocus={(e) => e.target.select()} /></Field>
            <button type="button" className="btn-ghost text-xs" onClick={() => copy(snippet, "snippet")}><Copy className="h-3.5 w-3.5" />{copied === "snippet" ? "Kopiert" : "Website-Baustein kopieren"}</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <a href={qr} download="termin-buchen-qr.png" title="QR-Code herunterladen (z. B. für Flyer und Fahrzeugbeschriftung)"><img src={qr} alt="QR-Code zur Buchungsseite" className="w-40 rounded-lg bg-white p-2" /></a>}
        </div>
        {!b.enabled && <p className="mt-3 text-xs text-amber-300">Die Seite ist noch ausgeschaltet – Besucher sehen „nicht aktiv“.</p>}
      </Panel>
      <SaveBar {...s} />
    </fieldset>
  );
}
