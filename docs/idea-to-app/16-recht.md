# Recht & Datenschutz

> Phase 16 im Modus „Bestehende App“, Stand 2026-10-24. **Keine Rechtsberatung.** Die ausführlichen Unterlagen liegen in `docs/recht/` (Übersicht: `docs/recht/README.md`). Dieses Dokument fasst die Antworten der Phase zusammen, zeigt die Umsetzung im Produkt und nennt, was eine Fachperson prüfen muss. Alle `[PRÜFEN]`-Stellen sind vor dem ersten zahlenden Kunden zu klären (Launch-Liste `23-launch.md`).

## Antworten der Phase

| Frage | Antwort | Folge |
|---|---|---|
| Q1 Betreiber | Unternehmen/Selbstständig (B2B-Plattform) | Impressum, AGB, AVV mit jedem Kunden |
| Q2 kommerziell | ja (Pakete, Minuten, Abrechnung) | Leistungsbeschreibung, SLA-Eckpunkte (`docs/recht/agb-sla-eckpunkte.md`) |
| Q3 Tracking | nein – kein Analytics, keine Werbung, keine Cookies außer der Sitzung | keine Einwilligung nach § 25 TDDDG nötig `[PRÜFEN]` |
| Q4 Drittland | ja: Twilio, Retell (USA), je nach Wahl Vapi/ElevenLabs | DPF/SCC je Anbieter, TIA für Retell (`docs/recht/unterauftragsverarbeiter.md`) |
| Q5 Kinder | nicht Zielgruppe; Anrufer können Kinder sein | keine besondere Funktion, Hinweis im VVT |
| Q6 KI | ja – b) Sprachassistent am Telefon, d) Dringlichkeit/Zuständigkeit wird vorgeschlagen | KI-Verordnung (Transparenz), DSFA-Prüfung |
| Q7 KI-Hinweis | a) in jeder Begrüßung, serverseitig erzwungen | `src/lib/voice/context.ts` (`AI_DISCLOSURE`, `buildGreeting`) |
| Q8 sensible Einsatzgebiete | nein (kein Anhang-III-Fall) `[PRÜFEN]` | Einordnung `docs/recht/ki-verordnung.md` |
| Q9 Daten an KI-Anbieter | b) Gesprächsinhalt, Name, Adresse, Rückrufnummer; c) Gesundheitsangaben möglich, nicht bezweckt | Datensparsamkeit, Löschfristen, DSFA |
| Q10 Training | Ausschluss je Anbieter vertraglich prüfen `[PRÜFEN]` | Spalte in `unterauftragsverarbeiter.md` |
| Q11 Nutzerinhalte für andere sichtbar | a) nein (jeder Mandant sieht nur seine Daten) | kein DSA-Meldeverfahren nötig |
| Q15 Betroffenenrechte | a) Funktionen im Portal (Auskunft/Export, Löschung je Anrufer, Kundenexport) + E-Mail | `src/lib/services/customers.ts`, `tenants.ts` |
| Q16 Verbraucher | c) nur Unternehmen (B2B) | keine Widerrufsbelehrung `[PRÜFEN]` |
| Q17 DSFA | a) Schwellwertprüfung durchgeführt (`docs/recht/dsfa.md`) | für Kunden voraussichtlich erforderlich, Vorlage Teil B |

## Checkliste

| ✓ | Punkt | Nachweis / Ort |
|---|---|---|
| ☑ | Rollenmodell: Kunde = Verantwortlicher, Betreiber = Auftragsverarbeiter (für Anruferdaten) und Verantwortlicher (Konten, Abrechnung) | `docs/recht/README.md` |
| ☑ | Verzeichnis von Verarbeitungstätigkeiten (als Verantwortlicher und als Auftragsverarbeiter) | `docs/recht/verarbeitungsverzeichnis.md` |
| ☑ | AVV-Vorlage mit TOM und Unterauftragnehmern | `docs/recht/avv-vorlage.md`, `toms.md`, `unterauftragsverarbeiter.md` |
| ☑ | Löschkonzept mit technischer Umsetzung (Fristen je Kunde, Löschung beim Anbieter, Monatsabschluss vor Löschung) | `docs/recht/loeschkonzept.md`, `src/lib/services/retention.ts`, `billing-close.ts` |
| ☑ | Datenpannen- und Notfallplan | `docs/recht/incident-plan.md` (Kontakte noch Platzhalter) |
| ☑ | Datenschutzerklärung und Impressum der Plattform als Entwurf | `docs/recht/datenschutzerklaerung-plattform.md`, `impressum-vorlage.md` |
| ☑ | Information für Anrufer (Art. 13) gestuft: Ansage + Text für die Website des Kunden | `docs/recht/anrufer-information.md`, Einstellung `privacyUrl` |
| ☑ | KI-Offenlegung (Art. 50 KI-VO) in jeder Begrüßung | `src/lib/voice/context.ts`, Test „ergänzt den KI-Hinweis bei eigener Begrüßung ohne Offenlegung“ (`tests/urgency.test.ts`) |
| ☑ | Aufzeichnung nur angesagt oder mit Einwilligung (Variante C), keine stille Aufzeichnung | `docs/recht/aufzeichnung.md`, Tool `recording_consent` |
| ☑ | SMS nur mit Einwilligung/ohne Widerspruch (STOP) | `Customer.smsConsentAt/smsOptOutAt`, Twilio-Fehler 21610 |
| ☑ | Betroffenenrechte als Funktion: Auskunft (Export), Löschung eines Anrufers, Kundenexport/-löschung | `customers.ts`, `tenants.ts`, Integrationstests |
| ☑ | Datensparsamkeit in Benachrichtigungen: Gesprächsinhalt in E-Mail/Kalender abschaltbar | Einstellung „Gesprächsinhalt in E-Mails und Kalender“ (T-SEC-32) |
| ☑ | Keine fremden Schriftarten/Skripte zur Laufzeit (Schrift lokal eingebunden) | `@fontsource-variable/figtree`, CSP `default-src 'self'` |
| ☑ | DSFA-Schwellwertprüfung | `docs/recht/dsfa.md` (Ergebnis: für Kunden voraussichtlich erforderlich) |
| ☐ | AVV mit allen Dienstleistern abgeschlossen (IONOS, Twilio, Retell, Vapi, ElevenLabs, SMTP) | offen – Betreiber |
| ☐ | Drittland: DPF-Status bzw. SCC und TIA je Anbieter | offen `[PRÜFEN]` |
| ☐ | Datenschutzbeauftragter: Pflicht geprüft (§ 38 BDSG) | offen `[PRÜFEN]` |
| ☐ | Alle `[PRÜFEN]`-Stellen in `docs/recht/` fachlich geklärt, Impressum/Datenschutzerklärung veröffentlicht, AGB/SLA final | offen – Fachperson |
| ☐ | Entscheidung „Aufzeichnung standardmäßig aus“ | offen (E-010) |

## KI-Inventur

| Funktion | Anbieter | Daten | Rolle nach KI-VO |
|---|---|---|---|
| Sprachassistent am Telefon (Annahme, Rückfragen, Termin, Notfall) | Retell AI, Vapi oder ElevenLabs (je Kunde/Nummer wählbar), deren LLM- und Sprachdienste | Gesprächsinhalt, Name, Adresse, Rückrufnummer, ggf. Gesundheitsangaben | Betreiber der Plattform voraussichtlich Anbieter des KI-Systems, Kunde Betreiber (deployer) `[PRÜFEN]` |
| Dringlichkeit und Zuständigkeit | eigene Regeln (`src/lib/urgency.ts`, `routing.ts`), KI-Vorschlag als Eingabe | Kategorie, Stichwörter, PLZ | keine automatisierte Entscheidung mit Rechtswirkung (Art. 22 DSGVO); Mensch kann übernehmen |

Menschliche Kontrolle: Jeder Vorgang ist im Portal sichtbar und änderbar; Notfälle werden an Menschen durchgestellt (seit Commit `0fafb35` mit Ziel nur aus den eigenen Daten). KI-Kompetenz (Art. 4 KI-VO): Einweisung der Kunden über `docs/recht/ki-verordnung.md` und das Support-Playbook `[PRÜFEN]`.

## Fristen, die vor dem Launch neu zu prüfen sind

- Zeitplan der KI-Verordnung (Transparenzpflichten seit 2. August 2026; Digital-Omnibus-Änderungen) – Neu prüfen bis: Launch `[PRÜFEN]`.
- DPF-Status der US-Anbieter – Neu prüfen bis: Launch `[PRÜFEN]`.
- DSK-Muss-Liste (KI zur Steuerung der Interaktion mit Betroffenen) – Neu prüfen bis: Launch `[PRÜFEN]`.
