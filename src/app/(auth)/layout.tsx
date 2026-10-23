import { Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 ring-1 ring-cyan-400/30">
            <Zap className="h-5 w-5 text-cyan-300" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-50">KI-Telefonzentrale</span>
        </div>
        <div className="glass p-6 animate-fadein">{children}</div>
      </div>
    </div>
  );
}
