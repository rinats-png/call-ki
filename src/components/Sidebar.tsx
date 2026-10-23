"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserRound, LayoutGrid, Users, Wrench, Settings, PhoneCall, Building2, LogOut, Zap, Server, Tags, Receipt, Gauge } from "lucide-react";
import { cn } from "@/lib/ui";
import { usePoll } from "@/lib/use-poll";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./session";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const TENANT_NAV: Item[] = [
  { href: "/", label: "Hub", icon: LayoutGrid },
  { href: "/calls", label: "Anrufe", icon: PhoneCall },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/team", label: "Team", icon: Wrench },
  { href: "/settings/plan", label: "Tarif", icon: Gauge },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];
const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Mandanten", icon: Building2 },
  { href: "/admin/pricing", label: "Preise & Pakete", icon: Tags },
  { href: "/admin/billing", label: "Abrechnung", icon: Receipt },
  { href: "/admin/platform", label: "Verbindungen", icon: Server },
];

function useNav() {
  const path = usePathname();
  const { me } = useSession();
  const rail = !!me?.isPlatformAdmin && !me.tenant;
  const nav = me?.isPlatformAdmin ? (me.tenant ? [...TENANT_NAV, ADMIN_NAV[0]] : ADMIN_NAV) : me ? TENANT_NAV : [];
  const isActive = (href: string) => {
    if (href === "/") return path === "/";
    if (href === "/admin") return path === "/admin" || path.startsWith("/admin/tenants");
    if (href === "/settings") return path.startsWith("/settings") && !path.startsWith("/settings/plan");
    return path.startsWith(href);
  };
  return { me, nav, rail, isActive, path };
}

/**
 * App-Rahmen im Stil „Design 17“:
 *  – Kundenportal: schmale Kopfleiste + schwebende Navigationsleiste unten (Dock)
 *  – Plattform-Admin: Glas-Seitenleiste links mit Kunden-Kontingent (ab lg), darunter Dock
 */
export function AppShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const { me, nav, rail, isActive, path } = useNav();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  const initials = (me?.tenant?.name ?? "KI").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={cn("min-h-screen", rail && "lg:grid lg:grid-cols-[272px_minmax(0,1fr)]")}>
      {rail && (
        <aside className="hidden lg:block">
          <AdminRail nav={nav} isActive={isActive} />
        </aside>
      )}
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="app-header sticky top-0 z-30">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 md:px-8">
            <Link href={rail ? "/admin" : "/"} title={me?.tenant?.name ?? "KI-Telefonzentrale"} className={cn("flex min-w-0 items-center gap-3", rail && "lg:invisible")}>
              <span className="brand-mark h-10 w-10 shrink-0">
                {me?.tenant?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.tenant.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : me?.tenant ? (
                  <span className="text-xs font-bold tracking-wide">{initials}</span>
                ) : (
                  <Zap className="h-[18px] w-[18px]" />
                )}
              </span>
              <span className="min-w-0 truncate text-[15px] font-extrabold text-zinc-50">{me?.tenant?.name ?? "KI-Telefonzentrale"}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              {me && (
                <Link href="/account" title="Mein Konto (Passwort, Zwei-Faktor-Anmeldung, Geräte)" className="hidden max-w-[220px] truncate text-xs font-medium text-zinc-500 transition hover:text-cyan-300 lg:inline">
                  {me.user.email}
                </Link>
              )}
              <Link href="/account" aria-label="Mein Konto" title="Mein Konto" className={cn("header-btn lg:hidden", path === "/account" && "text-cyan-300")}>
                <UserRound className="h-4 w-4" />
              </Link>
              <ThemeToggle />
              <button onClick={logout} title={me ? `Abmelden (${me.user.email})` : "Abmelden"} aria-label="Abmelden" className="header-btn">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          </div>
        </header>
        <main className={cn("mx-auto w-full min-w-0 max-w-[1500px] flex-1 px-4 pb-28 pt-4 md:px-8 md:pt-6", rail && "lg:pb-10")}>{children}</main>
        {footer}
      </div>
      {nav.length > 0 && (
        <nav aria-label="Hauptnavigation" className={cn("dock", rail && "lg:hidden")}>
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

type RailRow = { tenantId: string; tenantName: string; plan: { includedMinutes: number }; usage: { minutes: number }; invoice: { netCents: number }; usagePercent: number | null };

function Ring({ pct, className }: { pct: number | null; className?: string }) {
  const p = pct ?? 0;
  const color = p > 100 ? "stroke-rose-400" : p >= 85 ? "stroke-amber-400" : "stroke-cyan-400";
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className={className} role="img" aria-label={pct == null ? "ohne Kontingent" : `${Math.round(p)} % des Kontingents`}>
      <circle cx="20" cy="20" r="15" fill="none" className="stroke-zinc-800" strokeWidth="5" />
      <circle cx="20" cy="20" r="15" fill="none" className={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(94.2 * Math.min(p, 100)) / 100} 94.2`} transform="rotate(-90 20 20)" />
    </svg>
  );
}

function AdminRail({ nav, isActive }: { nav: Item[]; isActive: (h: string) => boolean }) {
  const { data } = usePoll<{ rows: RailRow[] }>("/api/admin/billing", 120_000);
  return (
    <div className="sticky top-0 h-screen p-4">
      <div className="glass flex h-full flex-col gap-1 overflow-hidden p-4">
        <Link href="/admin" className="mb-3 flex items-center gap-3 px-1">
          <span className="brand-mark h-10 w-10"><Zap className="h-[18px] w-[18px]" /></span>
          <span className="text-base font-extrabold text-zinc-50">Zentrale</span>
        </Link>
        <nav aria-label="Verwaltung" className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={cn("rail-item", isActive(href) && "rail-item-active")}>
              <Icon className="h-[18px] w-[18px]" />{label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-baseline justify-between px-1">
          <b className="text-sm text-zinc-100">Kunden</b>
          <span className="text-[11px] text-zinc-500">Kontingent</span>
        </div>
        <div className="-mr-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {data?.rows.map((r) => {
            const pct = r.usagePercent;
            return (
              <Link key={r.tenantId} href={`/admin/tenants/${r.tenantId}`} className="glass-soft grid grid-cols-[40px_1fr] items-center gap-2.5 px-2.5 py-2 transition hover:brightness-95">
                <Ring pct={pct} />
                <span className="min-w-0">
                  <span className="flex justify-between gap-2 text-[13px] font-bold text-zinc-100"><span className="truncate">{r.tenantName}</span><span className={cn(pct != null && pct > 100 ? "text-rose-400" : pct != null && pct >= 85 ? "text-amber-400" : "text-zinc-500")}>{pct == null ? "–" : `${Math.round(pct)}%`}</span></span>
                  <span className="block truncate text-[11px] text-zinc-500">{Math.round(r.usage.minutes)}{r.plan.includedMinutes ? `/${r.plan.includedMinutes}` : ""} Min.</span>
                </span>
              </Link>
            );
          })}
          {data && data.rows.length === 0 && <p className="px-1 text-xs text-zinc-500">Noch keine Kunden.</p>}
        </div>
      </div>
    </div>
  );
}
