"use client";

import { useState } from "react";
import { Check, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";

type Overview = {
  services: Record<"twilio" | "retell" | "microsoft" | "smtp" | "sms" | "toolSecret" | "cron", boolean>;
  tenants: Record<string, number>;
  failedMessages7d: number;
  webhooks: Record<string, string>;
};

const SERVICES: { key: keyof Overview["services"]; label: string; env: string; required: boolean }[] = [
  { key: "twilio", label: "Twilio (Telefonie)", env: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN", required: true },
  { key: "retell", label: "Retell AI (Sprach-KI)", env: "RETELL_API_KEY, RETELL_AGENT_ID", required: true },
  { key: "toolSecret", label: "Tool-Secret", env: "VOICE_TOOL_SECRET", required: true },
  { key: "smtp", label: "E-Mail-Versand", env: "SMTP_HOST, SMTP_FROM …", required: true },
  { key: "cron", label: "Löschfristen-Job", env: "CRON_SECRET", required: true },
  { key: "sms", label: "SMS-Versand", env: "TWILIO_SMS_FROM", required: false },
  { key: "microsoft", label: "Microsoft 365 (Multi-Tenant-App)", env: "MS_CLIENT_ID, MS_CLIENT_SECRET", required: false },
];

const HOOKS: Record<string, string> = {
  twilioVoice: "Twilio → Nummer → „A call comes in“ (POST)",
  twilioFallback: "Twilio → „Primary handler fails“",
  retellTools: "Retell → Custom Functions (je Funktion)",
  retellEvents: "Retell → Agent → Webhook URL",
  microsoftRedirect: "Entra-App → Redirect URI (Web)",
};

export default function Page() {
  const { data } = usePoll<Overview>("/api/admin/overview", 0);
  const [copied, setCopied] = useState<string | null>(null);
  if (!data) return <div className="mx-auto max-w-4xl"><Skeleton className="h-96" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Plattform</h1>
        <p className="text-sm text-zinc-500">Zentrale Dienste und Webhooks – gelten für alle Mandanten.</p>
      </header>
      <Panel title="Dienste">
        <ul className="divide-y divide-zinc-800">
          {SERVICES.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-zinc-200">{s.label}<span className="ml-2 font-mono text-[11px] text-zinc-500">{s.env}</span></span>
              {data.services[s.key] ? (
                <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><CheckCircle2 className="h-3 w-3" />aktiv</span>
              ) : (
                <span className={cn("chip", s.required ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "border-zinc-700 text-zinc-400")}><AlertTriangle className="h-3 w-3" />{s.required ? "fehlt" : "optional"}</span>
              )}
            </li>
          ))}
        </ul>
        {data.failedMessages7d > 0 && <p className="mt-3 text-xs text-amber-400">{data.failedMessages7d} fehlgeschlagene Benachrichtigungen in den letzten 7 Tagen.</p>}
      </Panel>
      <Panel title="Webhook-URLs">
        <div className="space-y-2">
          {Object.entries(data.webhooks).map(([k, url]) => (
            <div key={k} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 pl-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-zinc-500">{HOOKS[k] ?? k}</div>
                <code className="block truncate font-mono text-xs text-cyan-300">{url}</code>
              </div>
              <button className="btn-ghost p-2" aria-label="Kopieren" onClick={() => { navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1500); }}>
                {copied === url ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">Prompt und Funktionsdefinitionen für den Retell-Agenten liegen im Repository unter <code>voice-agent/</code>. Ein Agent bedient alle Kunden – Firmenname, Branche, FAQ usw. kommen als Variablen pro Anruf.</p>
      </Panel>
    </div>
  );
}
