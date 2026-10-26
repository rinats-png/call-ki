"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserRound, LayoutGrid, Users, Wrench, Settings, PhoneCall, Building2, LogOut, Zap, Server, Tags, Receipt, Gauge, Activity, FileText, CalendarDays } from "lucide-react";
import { cn } from "@/lib/ui";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./session";
import { SidePanel } from "./SidePanel";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

type NavItem = Item & { module?: string };
const TENANT_NAV: NavItem[] = [
  { href: "/", label: "Hub", icon: LayoutGrid },
  { href: "/calls", label: "Anrufe", icon: PhoneCall },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/planning", label: "Teamkalender", icon: CalendarDays, module: "planning" },
  { href: "/billing", label: "Rechnungen", icon: FileText, module: "invoicing" },
  { href: "/team", label: "Team", icon: Wrench },
  { href: "/settings/plan", label: "Tarif", icon: Gauge },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];
const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Leitstand", icon: Activity },
  { href: "/admin/pricing", label: "Preise & Pakete", icon: Tags },
  { href: "/admin/billing", label: "Abrechnung", icon: Receipt },
  { href: "/admin/platform", label: "Verbindungen", icon: Server },
];

function useNav() {
  const path = usePathname();
  const { me } = useSession();
  const admin = !!me?.isPlatformAdmin && !me.tenant;
  // Zusatzoptionen erscheinen erst, wenn gebucht (Rechnungen zusätzlich als Archiv, falls Belege existieren)
  const tenantNav = TENANT_NAV.filter((i) => !i.module || me?.tenant?.modules.includes(i.module) || (i.module === "invoicing" && me?.tenant?.hasBills));
  const nav = me?.isPlatformAdmin
    ? me.tenant ? [...tenantNav, { href: "/admin", label: "Verwaltung", icon: Building2 }] : ADMIN_NAV
    : me ? tenantNav : [];
  const isActive = (href: string) => {
    if (href === "/") return path === "/";
    if (href === "/admin") return path === "/admin" || path.startsWith("/admin/tenants");
    if (href === "/settings") return path.startsWith("/settings") && !path.startsWith("/settings/plan");
    return path.startsWith(href);
  };
  return { me, nav, admin, isActive, path };
}

/**
 * App-Rahmen im Glas-Stil (Entwurf G01–G13):
 *  – schwebende Icon-Leiste links (ab lg), auf kleinen Bildschirmen eine Leiste unten
 *  – ein großes Glasfenster mit Inhalt und – ab xl – fester rechter Spalte (Profil, Schnellaktionen, Karte, Liste)
 */
export function AppShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const { me, nav, admin, isActive, path } = useNav();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  const initials = (me?.tenant?.name ?? "KI").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen p-2 pb-24 sm:p-4 sm:pb-24 lg:py-5 lg:pb-5 lg:pl-[84px] lg:pr-5">
      {nav.length > 0 && (
        <nav aria-label="Hauptnavigation" className="rail fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 lg:flex">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} title={label} aria-label={label} aria-current={isActive(href) ? "page" : undefined} className={cn("rail-item", isActive(href) && "rail-item-active")}>
              <Icon className="h-[18px] w-[18px]" />
            </Link>
          ))}
          <span className="my-1 h-px w-6 bg-zinc-700/60" />
          <Link href="/account" title="Mein Konto" aria-label="Mein Konto" aria-current={path === "/account" ? "page" : undefined} className={cn("rail-item", path === "/account" && "rail-item-active")}>
            <UserRound className="h-[18px] w-[18px]" />
          </Link>
          <button type="button" onClick={logout} title="Abmelden" aria-label="Abmelden" className="rail-item">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </nav>
      )}

      <div className="window grid min-h-[calc(100vh-1rem)] overflow-hidden sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2.5rem)] xl:grid-cols-[minmax(0,1fr)_300px]">
        <span aria-hidden className="window-glow bottom-[-30%] left-[8%] h-[60vh] w-[60%]" style={{ background: "radial-gradient(closest-side, rgb(var(--glow-1) / var(--glow-1-alpha)), transparent)" }} />
        <span aria-hidden className="window-glow bottom-[-25%] right-[-8%] h-[50vh] w-[45%]" style={{ background: "radial-gradient(closest-side, rgb(var(--glow-2) / var(--glow-2-alpha)), transparent)" }} />

        <div className="relative flex min-w-0 flex-col">
          <header className="flex items-center justify-between gap-3 px-4 pt-4 md:px-7 md:pt-5">
            <Link href={admin ? "/admin" : "/"} title={me?.tenant?.name ?? "KI-Telefonzentrale"} className="flex min-w-0 items-center gap-3">
              <span className="brand-mark h-9 w-9 shrink-0">
                {me?.tenant?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.tenant.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : me?.tenant ? (
                  <span className="text-xs font-bold tracking-wide">{initials}</span>
                ) : (
                  <Zap className="h-[17px] w-[17px]" />
                )}
              </span>
              <span className="min-w-0 truncate text-sm font-bold text-zinc-300">{me?.tenant?.name ?? "KI-Telefonzentrale"}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2 xl:hidden">
              <ThemeToggle compact />
              <Link href="/account" aria-label="Mein Konto" title="Mein Konto" className="header-btn lg:hidden"><UserRound className="h-4 w-4" /></Link>
              <button onClick={logout} aria-label="Abmelden" title="Abmelden" className="header-btn lg:hidden"><LogOut className="h-4 w-4" /></button>
            </div>
          </header>
          <main className="relative w-full min-w-0 flex-1 px-4 pb-6 pt-4 md:px-7 md:pt-5">{children}</main>
          {footer}
        </div>

        <aside className="relative hidden border-l xl:block" style={{ borderColor: "rgb(var(--glass-border) / var(--glass-border-alpha))", background: "rgb(var(--glass) / calc(var(--glass-alpha) * 0.5))" }}>
          <div className="sticky top-0 max-h-screen overflow-y-auto">
            {me && <SidePanel me={me} admin={admin} onLogout={logout} />}
          </div>
        </aside>
      </div>

      {nav.length > 0 && (
        <nav aria-label="Hauptnavigation" className="dock lg:hidden">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={cn("nav-item", isActive(href) && "nav-item-active")}>
              <Icon className="h-[18px] w-[18px]" />
              <span className={cn(!isActive(href) && "hidden sm:inline")}>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
