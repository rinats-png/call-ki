# Produkt

> Phasen B0, B2 und 5 (Phasen 1–4 übersprungen, Modus „Bestehende App“). Stand 2026-10-24. Quellen: `docs/idea-to-app/B0-ziel.md`, `docs/idea-to-app/B2-soll-und-luecken.md`, `docs/idea-to-app/05-mvp.md`, `README.md`.

## Idee in einem Satz

Eine mandantenfähige KI-Telefonzentrale, die für kleine Betriebe jeden Anruf annimmt, sich als KI zu erkennen gibt, das Anliegen strukturiert aufnimmt, Termine bucht oder im Notfall durchstellt – und alles sofort im Portal zeigt.

## Ziel und Zielgruppe

- **Ziel (B0):** Verkauf an die ersten zahlenden Handwerks- und Dienstleistungsbetriebe; Soft Launch mit 1–2 Pilotbetrieben (E-020, A-001).
- **Kunden:** kleine Betriebe in Deutschland – Schädlingsbekämpfung, Handwerk (SHK/Elektro/Dach), allgemeine Dienstleister (Branchenvorlagen `src/lib/tenant/templates.ts`) [A-004].
- **Anrufer:** Verbraucher und Gewerbekunden der Betriebe, deutschsprachig [A-005].
- **Betreiber:** ein Plattform-Admin, voraussichtlich Kleinstunternehmen [A-007].

## Rollen

Plattform-Admin (Betreiber) · Kunden-Admin · Kunden-Mitarbeiter · technische Absender (Telefon-KI, Twilio, Cron). Details: Paket-`docs/daten-und-rechte.md`.

## Funktionsumfang

Vollständige Liste mit User Stories, Ist-Stand, Risiko und Akzeptanzkriterien: **`docs/idea-to-app/05-mvp.md`**.

| Priorität | Funktionen |
|---|---|
| Muss (25) | F-01 Anrufannahme · F-02 KI-Offenlegung · F-03 verifizierte Anrufernummer · F-04 Anliegen aufnehmen · F-05 Termine buchen · F-07 Notfall · F-08 Rückruf-Vorgang · F-09 Fallback/Ersatzziel · F-10 Benachrichtigungen · F-12 Hub · F-13 Anrufliste/Aufnahme · F-14 Kundenverwaltung/DSGVO · F-15 Team/Einsatzgebiete · F-16 Einstellungen · F-18 Konten/Zugang · F-19 Protokolle · F-20 Tarif/Verbrauch · F-21 Plattform-Verwaltung · F-22 Pakete · F-23 Abrechnung · F-24 Verbindungen · F-25 Kostenschutz · F-26 Überwachung · F-27 Löschfristen/Offboarding · F-28 Backups |
| Sollte | F-06 Termin verschieben/absagen · F-11 Terminerinnerung · F-17 Microsoft 365 / Google · F-29 Aufzeichnung mit Einwilligung (gebaut `ae31147`) · F-30 echte Rechnungen/Zahlung · F-37 Agent per API · F-39 Test-Kunde |
| Später | F-31 Self-Service Paketwechsel · F-32 Nummern kaufen · F-33 Mehrsprachigkeit · F-34 ausgehende Anrufe · F-35 weitere Anbindungen · F-36 Abwesenheiten · F-38 Statusseite |
| Nie (V1) | F-40 eigene Sprach-KI auf GPU-Server [A-006] |

**Ehrlicher Stand:** Fast alle Muss-Funktionen sind gebaut und automatisch getestet. Engpass ist der Nachweis mit echten Anbieter-Konten, Produktionsserver und Verträgen (Paket-`docs/roadmap.md`).

## Bewusst nicht in Version 1

Aufzeichnung als verkauftes Paket-Feature (bis E-010 entschieden), F-31–F-36, F-38, F-40, öffentliche Selbstregistrierung (Kunden werden vom Betreiber eingeladen).

## Preise und Kosten

Pakete und Grenzen: `src/lib/plan-limits.ts`, `src/lib/billing.ts`; Einkaufspreise und Marge: `docs/idea-to-app/17-kosten.md` (Phase 17, in Arbeit).
