import { setting } from "../platform/config";

/** Hat der Admin bestätigt, dass beim Anbieter keine Gesprächsinhalte gespeichert werden (Zero Retention)? */
export function zeroRetention(provider: string): boolean {
  const id = provider.startsWith("sip:") ? provider.slice(4) : provider;
  return setting(`${id.toUpperCase()}_ZERO_RETENTION`) === "true";
}
