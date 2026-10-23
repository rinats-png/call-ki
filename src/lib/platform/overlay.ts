/** Zwischenspeicher der Plattform-Einstellungen aus der Datenbank (ohne Abhängigkeiten, damit env.ts ihn nutzen kann). */
let overlay: Record<string, string> = {};
let version = 0;

export function getOverlay(): Record<string, string> {
  return overlay;
}
export function setOverlay(next: Record<string, string>): void {
  overlay = next;
  version++;
}
export function overlayVersion(): number {
  return version;
}
