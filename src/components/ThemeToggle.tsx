"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/ui";

type Theme = "light" | "dark";

/** Hell/Dunkel umschalten. Start = Systemeinstellung, Wahl wird im Browser gemerkt. */
export function ThemeToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#1e2229" : "#eef0f4");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* Speicher gesperrt – Wahl gilt nur für diese Sitzung */
    }
    setTheme(next);
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Hell" : "Dunkel";
  return (
    <button
      onClick={toggle}
      aria-label={`Zu ${label === "Hell" ? "hellem" : "dunklem"} Design wechseln`}
      title={`${label}er Modus`}
      className={cn(
        compact
          ? "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] text-zinc-500 hover:text-zinc-200"
          : "flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-800/70 hover:text-zinc-200",
        className,
      )}
    >
      {theme ? <Icon className="h-5 w-5" /> : <span className="h-5 w-5" />}
      {label}
    </button>
  );
}
