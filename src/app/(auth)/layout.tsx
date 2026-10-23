import { Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="app-header">
        <div className="mx-auto flex h-16 max-w-[1580px] items-center justify-between gap-3 px-4 md:h-20 md:px-8 lg:px-10">
          <span className="flex items-center gap-3">
            <span className="brand-mark h-9 w-9"><Zap className="h-[18px] w-[18px]" /></span>
            <span className="text-[13px] font-extrabold uppercase tracking-[0.13em] text-zinc-50">KI-Telefonzentrale</span>
          </span>
          <ThemeToggle />
        </div>
      </header>
      <main className="relative grid flex-1 place-items-center overflow-hidden px-4 py-10">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <span className="brand-mark h-14 w-14 rounded-2xl"><Zap className="h-6 w-6" /></span>
          </div>
          <div className="glass p-6 animate-fadein md:p-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
