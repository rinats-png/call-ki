"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Users, Wrench, Settings, PhoneCall, Building2, LogOut, Zap, Server } from "lucide-react";
import { cn } from "@/lib/ui";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./session";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const TENANT_NAV: Item[] = [
  { href: "/", label: "Hub", icon: LayoutGrid },
  { href: "/calls", label: "Anrufe", icon: PhoneCall },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/team", label: "Team", icon: Wrench },
  { href: "/settings", label: "Konto", icon: Settings },
];
const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Mandanten", icon: Building2 },
  { href: "/admin/platform", label: "Plattform", icon: Server },
];

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
    <>
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col items-center gap-2 border-r border-zinc-800/80 bg-zinc-950/70 py-5 backdrop-blur-md md:flex">
        <Link href={me?.isPlatformAdmin && !me.tenant ? "/admin" : "/"} title={me?.tenant?.name ?? "KI-Telefonzentrale"} className="mb-6 grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 ring-1 ring-cyan-400/30">
          {me?.tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.tenant.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : me?.tenant ? (
            <span className="text-xs font-bold text-cyan-200">{initials}</span>
          ) : (
            <Zap className="h-5 w-5 text-cyan-300" />
          )}
        </Link>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn("flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-medium transition", isActive(href) ? "bg-zinc-800/80 text-cyan-300" : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200")}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{label}</span>
          </Link>
        ))}
        <div className="mt-auto flex flex-col items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} title={me ? `Abmelden (${me.user.email})` : "Abmelden"} className="flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-800/50 hover:text-zinc-200">
            <LogOut className="h-5 w-5" />
            Abmelden
          </button>
        </div>
      </aside>
      <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl border border-zinc-800 bg-zinc-900/95 p-1.5 shadow-lg backdrop-blur-md md:hidden">
        {nav.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px]", isActive(href) ? "bg-zinc-800 text-cyan-300" : "text-zinc-500")}>
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-0.5">{label}</span>
          </Link>
        ))}
        <ThemeToggle compact />
      </nav>
    </>
  );
}
