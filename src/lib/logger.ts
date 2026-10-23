type Level = "debug" | "info" | "warn" | "error";

/** Strukturiertes JSON-Logging (kompatibel mit Vercel / Docker / Loki). */
function log(level: Level, event: string, data?: Record<string, unknown>) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (e: string, d?: Record<string, unknown>) => log("debug", e, d),
  info: (e: string, d?: Record<string, unknown>) => log("info", e, d),
  warn: (e: string, d?: Record<string, unknown>) => log("warn", e, d),
  error: (e: string, d?: Record<string, unknown>) => log("error", e, d),
};
