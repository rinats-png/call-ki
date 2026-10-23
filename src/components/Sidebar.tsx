"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users, Wrench, PlugZap, Zap } from "lucide-react";
import { cn } from "@/lib/ui";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Hub", icon: LayoutGrid },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/team", label: "Team", icon: Wrench },
  { href: "/setup", label: "Setup", icon: PlugZap },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col items-center gap-2 border-r border-zinc-800/80 bg-zinc-950/70 py-5 backdrop-blur-md md:flex">
        <Link href="/" className="mb-6 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 ring-1 ring-cyan-400/30">
          <Zap className="h-5 w-5 text-cyan-300" />
        </Link>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-medium transition",
                active ? "bg-zinc-800/80 text-cyan-300" : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <ThemeToggle className="mt-auto" />
      </aside>
      <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl border border-zinc-800 bg-zinc-900/95 p-1.5 shadow-lg backdrop-blur-md md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px]", active ? "bg-zinc-800 text-cyan-300" : "text-zinc-500")}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <ThemeToggle compact />
      </nav>
    </>
  );
}
