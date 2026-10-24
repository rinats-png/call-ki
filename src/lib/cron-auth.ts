import { env } from "./env";
import { safeEqual } from "./security";

/** Cron-Endpunkte: Authorization: Bearer CRON_SECRET (ohne gesetztes Secret immer abgelehnt). */
export function cronAuthorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return !!secret && safeEqual(given, secret);
}
