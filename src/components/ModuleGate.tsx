"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useSession } from "./session";

const NAMES: Record<string, string> = { invoicing: "Angebote & Rechnungen", field_app: "Techniker-App", customer_contact: "Kundenkontakt plus" };

/** Seite einer Zusatzoption: ohne Buchung ein freundlicher Hinweis statt halber Funktionen. */
export function ModuleGate({ module, children, allow }: { module: string | string[]; children: React.ReactNode; allow?: boolean }) {
  const { me, isTenantAdmin } = useSession();
  const keys = Array.isArray(module) ? module : [module];
  if (allow || keys.some((k) => me?.tenant?.modules.includes(k))) return <>{children}</>;
  return (
    <div className="glass mx-auto max-w-lg space-y-3 p-6 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-cyan-300" />
      <h2 className="text-lg font-semibold text-zinc-100">Zusatzoption „{keys.map((k) => NAMES[k] ?? k).join(" / ")}“</h2>
      <p className="text-sm text-zinc-400">Diese Funktion gehört zu einer Zusatzoption, die Sie noch nicht gebucht haben.</p>
      {isTenantAdmin ? <Link className="btn-primary inline-flex" href="/settings/plan#zusatzoptionen">Zusatzoptionen ansehen</Link> : <p className="text-xs text-zinc-500">Ein Administrator Ihres Unternehmens kann sie unter Tarif hinzubuchen.</p>}
    </div>
  );
}
