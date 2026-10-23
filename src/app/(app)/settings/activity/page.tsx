"use client";

import { usePoll } from "@/lib/use-poll";
import { cn, fmtDateTime, MESSAGE_STATUS, PURPOSE_LABEL } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { useSession } from "@/components/session";

type Msg = { id: string; channel: string; recipient: string; subject: string | null; purpose: string; status: string; error: string | null; createdAt: string };
type Log = { id: string; action: string; target: string | null; userEmail: string; createdAt: string };

const ACTION: Record<string, string> = {
  "auth.login": "Anmeldung", "auth.locked": "Konto gesperrt (Fehlversuche)", "auth.invite_accepted": "Einladung angenommen", "auth.password_reset": "Passwort zurückgesetzt",
  "settings.update": "Einstellungen geändert", "employee.create": "Mitarbeiter angelegt", "employee.update": "Mitarbeiter geändert",
  "customer.update": "Kunde geändert", "customer.erase": "Kunde gelöscht (DSGVO)", "customer.export": "Datenauskunft erstellt",
  "ticket.update": "Vorgang geändert", "ticket.create_manual": "Vorgang manuell erfasst", "user.invite": "Benutzer eingeladen", "user.update": "Benutzer geändert",
  "integration.microsoft.connect": "Microsoft 365 verbunden", "integration.microsoft.disconnect": "Microsoft 365 getrennt",
  "platform.enter_tenant": "Support-Zugriff durch Anbieter", "tenant.create": "Konto angelegt", "tenant.update": "Konto geändert (Anbieter)",
  "number.assign": "Rufnummer zugewiesen", "number.remove": "Rufnummer entfernt", "user.link_issued": "Zugangslink erstellt (Anbieter)",
};

export default function Page() {
  const { isTenantAdmin } = useSession();
  const { data: msgs } = usePoll<Msg[]>("/api/messages", 15000);
  const { data: logs } = usePoll<Log[]>(isTenantAdmin ? "/api/audit" : null, 0);

  return (
    <div className="space-y-5">
      <Panel title="Versendete Benachrichtigungen">
        {!msgs ? <Skeleton className="h-32" /> : msgs.length === 0 ? <p className="text-sm text-zinc-500">Noch keine Nachrichten.</p> : (
          <ul className="divide-y divide-zinc-800 text-sm">
            {msgs.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-32 shrink-0 text-xs text-zinc-500">{fmtDateTime(m.createdAt)}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-300">{m.channel === "SMS" ? "SMS" : "E-Mail"} · {PURPOSE_LABEL[m.purpose] ?? m.purpose} → {m.recipient}</span>
                <span className={cn("chip", MESSAGE_STATUS[m.status]?.chip)} title={m.error ?? undefined}>{MESSAGE_STATUS[m.status]?.label ?? m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {isTenantAdmin && (
        <Panel title="Aktivitätsprotokoll">
          {!logs ? <Skeleton className="h-32" /> : (
            <ul className="divide-y divide-zinc-800 text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-32 shrink-0 text-xs text-zinc-500">{fmtDateTime(l.createdAt)}</span>
                  <span className="min-w-0 flex-1 text-zinc-300">{ACTION[l.action] ?? l.action}</span>
                  <span className="text-xs text-zinc-500">{l.userEmail}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
