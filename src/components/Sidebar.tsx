"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserRound, LayoutGrid, Users, Wrench, Settings, PhoneCall, Building2, LogOut, Zap, Server } from "lucide-react";
import { cn } from "@/lib/ui";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./session";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const TENANT_NAV: Item[] = [
  { href: "/", label: "Hub", icon: LayoutGrid },
  { href: "/calls", label: "Anrufe", icon: PhoneCall },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/team", label: "Team", icon: Wrench },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];
const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Mandanten", icon: Building2 },
  { href: "/admin/platform", label: "Plattform", icon: Server },
];

/**
 * App-Navigation im Stil „Kopfleiste + horizontale Navigation“:
 * oben Marke und Konto-Aktionen, darunter die Menüpunkte (mobil horizontal scrollbar).
 * Der Komponentenname bleibt aus Kompatibilitätsgründen „Sidebar“.
 */
export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { me } = useSession();
  const nav = me?.isPlatformAdmin ? (me.tenant ? [...TENANT_NAV, ...ADMIN_NAV.slice(0, 1)] : ADMIN_NAV) : me ? TENANT_NAV : [];
  const isActive = (href: string) => (href === "/" ? path === "/" : href === "/admin" ? path === "/admin" || path.startsWith("/admin/tenants") : path.startsWith(href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const initials = (me?.tenant?.name ?? "KI").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="sticky top-0 z-40">
      <header className="app-header">
        <div className="mx-auto flex h-16 max-w-[1580px] items-center justify-between gap-3 px-4 md:h-20 md:px-8 lg:px-10">
          <Link href={me?.isPlatformAdmin && !me.tenant ? "/admin" : "/"} title={me?.tenant?.name ?? "KI-Telefonzentrale"} className="flex min-w-0 items-center gap-3">
            <span className="brand-mark h-9 w-9 shrink-0">
              {me?.tenant?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.tenant.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : me?.tenant ? (
                <span className="text-[11px] font-bold tracking-wide">{initials}</span>
              ) : (
                <Zap className="h-[18px] w-[18px]" />
              )}
            </span>
            <span className="flex min-w-0 items-center text-[13px]">
              <span className="hidden font-extrabold uppercase tracking-[0.13em] text-zinc-50 sm:inline">KI-Telefonzentrale</span>
              {me?.tenant && (
                <>
                  <span className="mx-3 hidden font-light text-zinc-600 sm:inline">/</span>
                  <span className="truncate font-medium text-zinc-300">{me.tenant.name}</span>
                </>
              )}
              {!me?.tenant && <span className="font-extrabold uppercase tracking-[0.13em] text-zinc-50 sm:hidden">KI-Telefonzentrale</span>}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {me && (
              <Link href="/account" title="Mein Konto (Passwort, Zwei-Faktor-Anmeldung, Geräte)" className="hidden max-w-[220px] truncate text-xs text-zinc-500 transition hover:text-cyan-300 lg:inline">
                {me.user.email}
              </Link>
            )}
            <Link href="/account" aria-label="Mein Konto" title="Mein Konto" className={cn("header-btn lg:hidden", path === "/account" && "text-cyan-300")}>
              <UserRound className="h-4 w-4" />
            </Link>
            {me && <span className="divider-v hidden lg:block" />}
            <ThemeToggle />
            <button onClick={logout} title={me ? `Abmelden (${me.user.email})` : "Abmelden"} aria-label="Abmelden" className="header-btn">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </header>
      {nav.length > 0 && (
        <nav aria-label="Hauptnavigation" className="app-nav bg-[rgb(var(--page)/0.88)] backdrop-blur-md">
          <div className="mx-auto flex max-w-[1580px] items-center gap-1.5 overflow-x-auto px-4 py-2.5 md:px-8 md:py-3 lg:px-10">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={cn("nav-item", isActive(href) && "nav-item-active")}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
