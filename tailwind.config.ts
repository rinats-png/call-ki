import type { Config } from "tailwindcss";

/** Farbskalen kommen aus CSS-Variablen (src/app/globals.css) – so gelten sie für Hell- und Dunkelmodus. */
const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((n) => [n, `rgb(var(--${name}-${n}) / <alpha-value>)`]));

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zinc: scale("z", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        cyan: scale("a", [50, 200, 300, 400, 500]), // Akzent (Blau/Indigo)
        emerald: scale("g", [200, 300, 400, 500]), // Live / Erfolg
        amber: scale("w", [200, 300, 400, 500]), // Notfall / Warnung
        scrim: "rgb(var(--scrim) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        ping2: { "75%, 100%": { transform: "scale(2.2)", opacity: "0" } },
        slidein: { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        fadein: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        ping2: "ping2 1.6s cubic-bezier(0,0,0.2,1) infinite",
        slidein: "slidein 0.25s ease-out",
        fadein: "fadein 0.3s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
