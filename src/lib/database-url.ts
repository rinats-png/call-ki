import { getConnectionString } from "@netlify/database";

/**
 * Verbindungs-URL der Datenbank. VPS/Docker: DATABASE_URL. Test-Umgebung auf Netlify:
 * automatisch bereitgestellte Netlify Database (NETLIFY_DB_URL bzw. getConnectionString()).
 */
export function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NETLIFY_DB_URL) return process.env.NETLIFY_DB_URL;
  if (!process.env.NETLIFY) return undefined;
  try {
    return getConnectionString();
  } catch {
    return undefined;
  }
}
