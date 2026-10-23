import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hub: { bg: "#09090b", panel: "#121214" },
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
