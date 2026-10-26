"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarClock, Bell, Plug, Gauge, UserCog, History, ListChecks, Receipt, Smartphone } from "lucide-react";
import { cn } from "@/lib/ui";
import { useSession } from "@/components/session";

const TABS = [
  { href: "/settings", label: "Unternehmen & KI", hint: "Firma, Begrüßung, Wissen", icon: Building2 },
  { href: "/settings/scheduling", label: "Termine & Notfall", hint: "Zeiten, Dauer, Notdienst", icon: CalendarClock },
  { href: "/settings/services", label: "Leistungen", hint: "Dauer, Gewerk, Preis", icon: ListChecks },
  { href: "/settings/invoicing", label: "Rechnungen", hint: "Steuernummer, Bank, Mahnung", icon: Receipt, modules: ["invoicing"] },
  { href: "/settings/jobs", label: "Einsätze", hint: "Techniker-App, Kundenkontakt", icon: Smartphone, modules: ["field_app", "customer_contact"] },
  { href: "/settings/notifications", label: "Benachrichtigungen", hint: "E-Mail und SMS", icon: Bell },
  { href: "/settings/integrations", label: "Integrationen", hint: "Kalender, Rufumleitung", icon: Plug },
  { href: "/settings/plan", label: "Tarif & Verbrauch", hint: "Paket, Minuten, Rechnung", icon: Gauge },
  { href: "/settings/users", label: "Benutzer", hint: "Zugänge und Rollen", icon: UserCog, admin: true },
  { href: "/settings/activity", label: "Protokoll", hint: "Wer hat was geändert", icon: History },
] as { href: string; label: string; hint: string; icon: typeof Building2; admin?: boolean; modules?: string[] }[];

/** Einstellungen: Glas-Menü links (mobil als Pillen oben), Inhalt rechts. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { isTenantAdmin, me } = useSession();
  // Reiter von Zusatzoptionen nur, wenn gebucht – keine Funktionen zeigen, die der Kunde nicht hat
  const tabs = TABS.filter((t) => (!t.admin || isTenantAdmin) && (!t.modules || t.modules.some((m) => me?.tenant?.modules.includes(m))));

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50 md:text-[26px]">Einstellungen</h1>
        <p className="text-sm text-zinc-500">{isTenantAdmin ? "So arbeitet Ihre KI-Telefonzentrale für Sie." : "Nur Administratoren können Einstellungen ändern."}</p>
      </header>

      <nav aria-label="Einstellungen" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => {
          const on = path === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} title={t.hint} className={cn("btn-ghost shrink-0 px-3.5 py-2 text-xs", on && "nav-item-active border-transparent")}>
              <t.icon className="h-4 w-4" />{t.label}
            </Link>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-5">{me && children}</div>
    </div>
  );
}
