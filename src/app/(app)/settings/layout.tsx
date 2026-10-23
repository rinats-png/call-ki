"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarClock, Bell, Plug, Gauge, UserCog, History } from "lucide-react";
import { cn } from "@/lib/ui";
import { useSession } from "@/components/session";

const TABS = [
  { href: "/settings", label: "Unternehmen & KI", hint: "Firma, Begrüßung, Wissen", icon: Building2 },
  { href: "/settings/scheduling", label: "Termine & Notfall", hint: "Zeiten, Dauer, Notdienst", icon: CalendarClock },
  { href: "/settings/notifications", label: "Benachrichtigungen", hint: "E-Mail und SMS", icon: Bell },
  { href: "/settings/integrations", label: "Integrationen", hint: "Kalender, Rufumleitung", icon: Plug },
  { href: "/settings/plan", label: "Tarif & Verbrauch", hint: "Paket, Minuten, Rechnung", icon: Gauge },
  { href: "/settings/users", label: "Benutzer", hint: "Zugänge und Rollen", icon: UserCog, admin: true },
  { href: "/settings/activity", label: "Protokoll", hint: "Wer hat was geändert", icon: History },
];

/** Einstellungen: Glas-Menü links (mobil als Pillen oben), Inhalt rechts. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { isTenantAdmin, me } = useSession();
  const tabs = TABS.filter((t) => !t.admin || isTenantAdmin);
  const current = tabs.find((t) => t.href === path) ?? tabs[0];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-50">Einstellungen</h1>
          <p className="text-sm text-zinc-500">{isTenantAdmin ? "Steuern Sie, wie die KI-Telefonzentrale für Sie arbeitet." : "Nur Administratoren können Einstellungen ändern."}</p>
        </div>
      </header>

      <nav aria-label="Einstellungen" className="glass flex gap-1 overflow-x-auto rounded-full p-1 lg:hidden">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined} className={cn("nav-item py-2", path === t.href && "nav-item-active")}>
            <t.icon className="h-4 w-4" />{t.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:block">
          <nav aria-label="Einstellungen" className="glass sticky top-20 space-y-1 p-3">
            {me?.tenant && (
              <div className="mb-2 flex items-center gap-3 rounded-2xl px-2 py-2">
                <span className="brand-mark h-10 w-10 shrink-0 text-xs font-bold">{me.tenant.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-bold text-zinc-50">{me.tenant.name}</span><span className="block text-xs text-zinc-500">{isTenantAdmin ? "Administrator" : "Nur lesen"}</span></span>
              </div>
            )}
            {tabs.map((t) => {
              const on = path === t.href;
              return (
                <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 transition", on ? "rail-item-active" : "text-zinc-300 hover:bg-zinc-950/70")}>
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", on ? "bg-white/15" : "bg-zinc-950/80 text-cyan-300")}><t.icon className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className={cn("block truncate text-xs", on ? "opacity-75" : "text-zinc-500")}>{t.hint}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 space-y-5">
          <div className="hidden lg:block">
            <h2 className="text-xl font-bold text-zinc-50">{current.label}</h2>
            <p className="text-sm text-zinc-500">{current.hint}</p>
          </div>
          {me && children}
        </div>
      </div>
    </div>
  );
}
