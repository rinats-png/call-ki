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
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#13262a" : "#eaf1ee");
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
      className={cn("header-btn", className)}
    >
      {theme ? <Icon className="h-4 w-4" /> : <span className="h-4 w-4" />}
      <span className={cn(compact ? "sr-only" : "hidden sm:inline")}>{label}</span>
    </button>
  );
}
