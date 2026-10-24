# Design und Barrierefreiheit

> Phase 9 übersprungen (Glas-Design „Mint auf Glas“ ist umgesetzt, Entwürfe G01–G13), Phase 10 verkürzt fertig. Stand 2026-10-24. **Maßgeblich:** `docs/idea-to-app/10-barrierefreiheit.md`.

## Design

- Tokens und Grundstile: `tailwind.config.ts`, `src/app/globals.css` (Farben, Glasflächen, Leuchten, Fokus-Stil `:focus-visible` 2 px).
- Komponenten: `src/components/` (u. a. `Sidebar.tsx`, `TenantBanner`, Diagramme `AreaChart.tsx`/`BarChart.tsx`, Wellenform-Player für Aufnahmen). Neue Oberflächen nutzen diese Komponenten statt eigener Stile.
- Schrift lokal ausgeliefert (`@fontsource-variable/figtree`), Icons `lucide-react` (Regel 7.5).
- Keine Mockups im Paket; der umgesetzte Code ist die Referenz.

## Barrierefreiheit

- Ziel: WCAG 2.2 AA als Qualitätsziel für das Portal (B2B, BFSG voraussichtlich nicht anwendbar – [PRÜFEN] für den Telefonkanal, A-007).
- **Ehrlicher Stand:** nur per Code-Suche geprüft; keine Kontrastmessung, kein Screenreader- oder Tastatur-Durchgang, kein axe/Lighthouse. Glas-Design mit Transparenz und hellgrauer Schrift ist für Kontraste gefährdet.
- Bei jeder UI-Änderung: sichtbare Beschriftung je Feld (nicht nur `placeholder`), Fehlermeldungen als Text (A-016), Tastaturbedienung, sichtbarer Fokus, Textalternative für Diagramme, Tippflächen ≥ 44×44 px.
- Aufgaben: TASK-042 (Kontraste, Beschriftungen, Tastatur-Durchgang S01/S10/S11/S12/S14/S21), TASK-043 (axe in der CI).

## Sprache und Formate

Oberfläche nur Deutsch, Texte direkt in den Komponenten (keine i18n-Struktur; Mehrsprachigkeit = F-33/TASK-052). Datum/Zeit über `src/lib/time.ts` in der Zeitzone des Mandanten (Standard Europe/Berlin, E-015), Wochenanfang Montag [A-008].
