"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";
import { useSession } from "@/components/session";

const TABS = [
  { href: "/settings", label: "Unternehmen & KI" },
  { href: "/settings/scheduling", label: "Termine & Notfall" },
  { href: "/settings/notifications", label: "Benachrichtigungen" },
  { href: "/settings/integrations", label: "Integrationen" },
  { href: "/settings/users", label: "Benutzer", admin: true },
  { href: "/settings/activity", label: "Protokoll" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { isTenantAdmin, me } = useSession();
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Einstellungen</h1>
          <p className="text-sm text-zinc-500">{isTenantAdmin ? "Steuern Sie, wie die KI-Telefonzentrale für Sie arbeitet." : "Nur Administratoren können Einstellungen ändern."}</p>
        </div>
        <button
          className="btn-ghost text-xs md:hidden"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            location.href = "/login";
          }}
        >
          Abmelden
        </button>
      </header>
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.filter((t) => !t.admin || isTenantAdmin).map((t) => (
          <Link key={t.href} href={t.href} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition", path === t.href ? "bg-zinc-800 text-zinc-50" : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {me && children}
    </div>
  );
}
