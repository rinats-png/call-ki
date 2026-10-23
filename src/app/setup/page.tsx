"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Panel } from "@/components/hub/Primitives";

const STEPS = [
  {
    title: "1 · Twilio",
    items: [
      { label: "A call comes in (HTTP POST)", path: "/api/twilio/voice" },
      { label: "Primary handler fails", path: "/api/twilio/fallback" },
    ],
    note: "In der Twilio Console unter Phone Numbers → Voice Configuration eintragen. TWILIO_AUTH_TOKEN und PUBLIC_BASE_URL setzen, damit die Signaturprüfung greift.",
  },
  {
    title: "2 · Retell AI / Vapi – Function Calling",
    items: [
      { label: "Sammel-Endpunkt (Vapi Server URL)", path: "/api/voice/tools" },
      { label: "identify_caller", path: "/api/voice/tools/identify_caller" },
      { label: "save_customer", path: "/api/voice/tools/save_customer" },
      { label: "find_technician", path: "/api/voice/tools/find_technician" },
      { label: "book_appointment", path: "/api/voice/tools/book_appointment" },
      { label: "escalate_emergency", path: "/api/voice/tools/escalate_emergency" },
    ],
    note: "Funktionsdefinitionen und System-Prompt liegen unter voice-agent/. Header x-tool-secret (Retell) bzw. Server URL Secret (Vapi) = VOICE_TOOL_SECRET.",
  },
  {
    title: "3 · Gesprächsende (Transkript & Zusammenfassung)",
    items: [{ label: "Retell Agent Webhook / Vapi end-of-call-report", path: "/api/voice/events" }],
    note: "Ordnet Transkripte automatisch dem Ticket des Anrufers zu und legt bei abgebrochenen Gesprächen ein Rückruf-Ticket an.",
  },
  {
    title: "4 · Microsoft Graph (Outlook)",
    items: [],
    note: "Entra ID → App-Registrierung → Application Permissions Calendars.ReadWrite + Mail.ReadWrite, Admin Consent erteilen. MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET und MS_DRAFT_MAILBOX setzen. Zugriff per Application Access Policy auf Storm-Postfächer beschränken.",
  },
];

export default function SetupPage() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  async function copy(v: string) {
    await navigator.clipboard.writeText(v).catch(() => undefined);
    setCopied(v);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Setup & Integrationen</h1>
        <p className="text-sm text-zinc-500">Webhook-URLs für Twilio, Sprach-KI und Microsoft Graph.</p>
      </header>
      {STEPS.map((s) => (
        <Panel key={s.title} title={s.title}>
          <div className="space-y-2">
            {s.items.map((it) => {
              const url = origin + it.path;
              return (
                <div key={it.path} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 pl-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-zinc-500">{it.label}</div>
                    <code className="block truncate font-mono text-xs text-cyan-200">{url}</code>
                  </div>
                  <button className="btn-ghost p-2" onClick={() => copy(url)} aria-label="Kopieren">
                    {copied === url ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">{s.note}</p>
        </Panel>
      ))}
    </div>
  );
}
