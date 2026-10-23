import { CalendarCheck, PhoneIncoming, ShieldCheck, Siren, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalFooter } from "@/components/LegalFooter";
import { AreaChart } from "@/components/AreaChart";

const FEATURES = [
  { icon: PhoneIncoming, title: "Nimmt jeden Anruf an", text: "Rund um die Uhr, auch wenn Ihr Team im Einsatz ist." },
  { icon: CalendarCheck, title: "Plant Termine selbst", text: "Direkt im internen, Outlook- oder Google-Kalender." },
  { icon: Siren, title: "Erkennt Notfälle", text: "Und stellt sofort zum Notdienst durch." },
];

// Dekorative Wellenform im Band (keine echten Daten)
const WAVE = [4, 6, 5, 8, 7, 3, 2, 7, 9, 8, 7, 10, 4, 3, 8, 11, 10, 9, 10, 5, 4, 9, 12].map((value, i) => ({ label: String(i), value }));

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:p-5">
        <aside className="hero relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-12">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20"><Zap className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold">KI-Telefonzentrale</span>
          </div>
          <div className="max-w-xl">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight [text-wrap:balance] xl:text-5xl">Kein Anruf geht mehr verloren.</h2>
            <p className="mt-3 text-lg opacity-90">Ihre KI-Assistentin am Telefon: freundlich, verlässlich und mit Blick auf Ihre Termine.</p>
            <ul className="mt-8 space-y-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-4 rounded-2xl bg-white/10 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20"><f.icon className="h-5 w-5" /></span>
                  <span><b className="block">{f.title}</b><span className="text-sm opacity-90">{f.text}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div aria-hidden className="-mx-2 opacity-80"><AreaChart ariaLabel="" data={WAVE} height={90} onHero /></div>
            <p className="mt-3 flex items-center gap-2 text-sm opacity-90"><ShieldCheck className="h-4 w-4" />Zwei-Faktor-Anmeldung und verschlüsselte Zugangsdaten</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 lg:invisible">
              <span className="brand-mark h-10 w-10"><Zap className="h-[18px] w-[18px]" /></span>
              <span className="text-[15px] font-extrabold text-zinc-50">KI-Telefonzentrale</span>
            </span>
            <ThemeToggle />
          </header>
          <main className="grid flex-1 place-items-center py-10">
            <div className="glass w-full max-w-md p-7 animate-fadein md:p-9">{children}</div>
          </main>
          <LegalFooter />
        </div>
      </div>
    </div>
  );
}
