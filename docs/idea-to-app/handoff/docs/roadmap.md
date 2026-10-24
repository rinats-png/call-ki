# Roadmap – Arbeitsliste für das Coding-Tool

> Phase 21, Stand 2026-10-24 (Code `5279652`). Quelle mit Beschreibung, Bezügen, Akzeptanzkriterien und Abhängigkeiten: `docs/idea-to-app/21-roadmap.md`; Merkliste: `docs/OFFENE-PUNKTE.md`. Diese Datei trägt den **aktuellen Status** inklusive der Commits nach `f605d85` nach. Bei jeder Statusänderung beide Dateien aktualisieren (mit Commit).
> Reihenfolge: M-S → M0 → M1 → M2 → M3 → M5; M4 läuft parallel (wartet auf Anbieter und Fachperson). Neue Funktionen (M6) erst nach dem Soft Launch.
> „extern“ = braucht echte Konten, den Produktionsserver, das GitHub-Konto oder eine Fachperson – nicht simulieren, sondern dem Projektinhaber die Schritte nennen.

## Meilensteine

| Meilenstein | Ziel | Fertig, wenn |
|---|---|---|
| M-S Sofortmaßnahmen | P0-Sicherheitslücken und hohe Befunde geschlossen | TASK-001–TASK-007 erledigt |
| M0 Fundament | Repository geschützt, Berechtigungen per HTTP- und E2E-Test belegt | TASK-006, TASK-008, TASK-009 erledigt, CI grün |
| M1 Sicherheit & Konten | Restlücken der Sicherheitsarchitektur zu | TASK-013, -040, -044, -048, -064, -065, -066 erledigt oder per `E-…` akzeptiert |
| M2 Kernfunktion | Telefon-KI mit echten Konten je Anbieter belegt | TASK-010, -011, -012, -061, -062 |
| M3 Weitere Muss-Funktionen | Abrechnung, Kalender, Zustellung verkaufsfähig | TASK-016, -017, -018, -025, -027, -063 |
| M4 Pflichten vor Launch | Verträge, Pflichttexte, DSFA, Aufzeichnung entschieden | TASK-030–TASK-039, -042, -043 |
| M5 Betrieb & Launch | Produktion mit Nachweisen, Pilot startet | TASK-020–TASK-024, -026, -028, -029, -045–TASK-047, -049; `pruefe-projekt.mjs --launch` ohne FEHLER |
| M6 Nach dem Launch | Ausbau | TASK-050 ff. nach Pilot-Rückmeldung |

## Aufgaben (Status)

| ID | MS | Titel (kurz) | Funktionen | Status |
|---|---|---|---|---|
| TASK-001 | M-S | Kundendaten nur zur verifizierten Nummer, Tools nur für laufende Anrufe, Geheimnis je Anbieter | F-01, F-03 | erledigt (`8bdaa52`) |
| TASK-002 | M-S | Kundentyp `BUSINESS`, Konsistenztest Agent-Tools ↔ Server-Schema | F-04, F-37 | erledigt (`8bdaa52`) |
| TASK-003 | M-S | Benachrichtigungen aus dem Gesprächspfad, Wiederholung, Alarm bei Notfall-Fehlschlag | F-10, F-07 | erledigt (`4a1309e`) |
| TASK-004 | M-S | Twilio-Statusmeldung als Gesprächsende, hängende Anrufe schließen | F-23, F-27 | erledigt (`7175b50`) |
| TASK-005 | M-S | `APP_ENCRYPTION_KEY` mit Schlüssel-ID und Rotation, Incident-Plan §3 | F-24 | erledigt (`fa49bd4`; Incident-Plan beschreibt den Wechsel) |
| TASK-006 | M-S | Repository privat (oder E-022 bewusst entscheiden), Branch-Schutz `main`, Dependabot-Sicherheitsupdates | – | **offen, extern** (GitHub-Konto, Entscheidung E-022) |
| TASK-007 | M-S | Twilio-Signaturprüfung in Produktion nicht abschaltbar | F-01 | erledigt (`bc90bbd`) |
| TASK-008 | M0 | HTTP-Tests je Endpunkt (fremder Mandant 404, Mitarbeiter 403, CSRF, Re-Auth, 2FA, Header) | F-14, F-18, F-21 | **teilweise**: T-SEC-HTTP-01…16 grün (`7404f55`, `33c0708`, `669cc2f`); offen laut `docs/idea-to-app/19-tests.md` → „Fehlende Tests“: fremden Kunden/Anruf/Mitarbeiter/Benutzer lesen, Listen `/api/calls`, `/api/customers`, `/api/messages`, Mitarbeiter auf DSGVO/Audit/Export/Integrationen, Re-Auth für Export/Löschung/Rollen/Mandantenwechsel, Limit „Benachrichtigung erneut senden“ |
| TASK-009 | M0 | E2E-Tests (Playwright) in der CI | F-12, F-13, F-14, F-15, F-16, F-18, F-19, F-21, F-22, F-24 | **teilweise**: Login mit 2FA, Mandantentrennung, falsches Passwort (`7404f55`); offen: Vorgang bearbeiten, Anruf ansehen/abspielen, Mitarbeiter anlegen, Einstellungen, DSGVO-Export/-Löschung, Offboarding |
| TASK-013 | M1 | Anrufe mit unterdrückter Nummer begrenzen | F-25 | erledigt (`7404f55`, 30/h je angerufener Nummer) |
| TASK-014 | M1 | Kostenschutz und Kontingent-Warnungen | F-25, F-20 | erledigt (`cbcdb54`) |
| TASK-015 | M1 | Paketgrenzen serverseitig | F-22 | erledigt (`91e56ea`) |
| TASK-041 | M1 | Sicherheitsrelevante Rate-Limits in PostgreSQL | F-18 | erledigt (`136bc7f`) |
| TASK-065 | M1 | SMS nur in erlaubte Länder; keine Durchstellung an vom Anrufer genannte Nummern | F-10, F-07 | **teilweise**: SMS-Länder (`0e0efc5`); offen: `transfer_call` beim Anbieter auf feste Ziele (extern, Anbieter-Konfiguration) |
| TASK-066 | M1 | Reset-/Einladungslinks für Kollegen nur nach Re-Auth | F-18 | erledigt (`0e0efc5`, T-SEC-HTTP-14) |
| TASK-040 | M1 | Major-Update Prisma 7 | – | offen (bis 2026-11-15, E-003) |
| TASK-064 | M1 | Major-Update Next 16 | – | offen |
| TASK-044 | M1 | CSP mit Nonces oder E-001 neu bestätigen | – | offen |
| TASK-048 | M1 | Abgleich OWASP ASVS Level 1 dokumentieren | – | teilweise (Abgleich in `14-sicherheit.md`) |
| TASK-010 | M2 | Testanruf-Protokoll (20 Szenarien) mit Retell | F-01, F-02, F-03, F-04, F-05, F-07, F-08, F-09 | **offen, extern** |
| TASK-011 | M2 | Testanrufe 1–12 mit Vapi und ElevenLabs | F-01, F-03, F-06 | offen, extern |
| TASK-061 | M2 | Echte Payloads als Fixtures, Vertragstests | F-01 | offen (nach TASK-010/011) |
| TASK-062 | M2 | Latenz/Gleichzeitigkeit mit echten Anbietern | F-01, F-25 | teilweise (lokaler Lasttest `94468b2`, p95 < 1 s); echte Anbieter offen, extern |
| TASK-012 | M2 | Löschung beim Anbieter mit echtem Konto belegen | F-27 | offen, extern |
| TASK-019 | M2 | Termine per Telefon verschieben/absagen | F-06 | erledigt (`eb9dcbd`) |
| TASK-016 | M3 | Google-OAuth-Verifizierung, Microsoft Publisher Verification | F-05, F-17 | offen, extern |
| TASK-017 | M3 | SPF, DKIM, DMARC | F-10 | offen, extern |
| TASK-018 | M3 | Agent-Einrichtung per API | F-37 | offen |
| TASK-025 | M3 | Kostenrechnung je Minute, Standardkosten in `src/lib/billing.ts` | F-23 | teilweise (SMS-Einkauf 10 ct in `48e363a`); Kosten je Anbieter offen |
| TASK-027 | M3 | Echte Rechnungen (Nummernkreis, PDF, Archiv) | F-30, F-23 | offen (Monatsabschluss GoBD als Grundlage erledigt, `48e363a`; Steuerberatung) |
| TASK-063 | M3 | Zahlung über Zahlungsanbieter mit Webhook, Mahnwesen | F-30 | offen |
| TASK-030 | M4 | AVV/DPA mit allen Anbietern | – | offen, extern |
| TASK-031 | M4 | Drittlandübermittlung je Anbieter | – | offen, extern |
| TASK-032 | M4 | DSFA-Schwellwertprüfung, DSB-Pflicht | – | offen, extern |
| TASK-033 | M4 | E-010 entscheiden, Standard und Paket-Feature „Aufzeichnung“ koppeln | F-02, F-22 | offen (Entscheidung Inhaber) |
| TASK-034 | M4 | Aufzeichnung mit Einwilligung (Variante C) | F-29 | **teilweise**: gebaut und getestet (`ae31147`); Löschung nach „Nein“ mit echtem Konto offen (extern) |
| TASK-035 | M4 | Impressum, Datenschutz, AGB/SLA, `LEGAL_IMPRINT_URL`/`LEGAL_PRIVACY_URL` | – | offen, extern |
| TASK-036 | M4 | Export/Löschung eines Mandanten auf Produktion prüfen; Abrechnungsdaten ausnehmen | F-14, F-27 | teilweise (Abrechnung bleibt erhalten, `48e363a`); Produktionsprüfung offen |
| TASK-037 | M4 | Rechtsunterlagen um Vapi, ElevenLabs, Google ergänzen; `[PRÜFEN]` klären | – | teilweise (`5279652`); fachliche Klärung offen, extern |
| TASK-038 | M4 | KI-Kompetenz (Art. 4 KI-VO) nachweisen | – | offen |
| TASK-039 | M4 | Rechtsgrundlage SMS, Abbestellen | F-10, F-11 | teilweise (SMS-Einwilligung/-Widerspruch `ae31147`); rechtliche Klärung offen |
| TASK-042 | M4 | Barrierefreiheit prüfen (Kontrast, Beschriftung, Tastatur) | – | offen |
| TASK-043 | M4 | axe-Check in der CI | – | offen |
| TASK-020 | M5 | IONOS-VPS aufsetzen und härten, Nachweise | – | offen, extern |
| TASK-021 | M5 | Backups auf Produktion, erster Wiederherstellungstest | F-28 | offen, extern |
| TASK-022 | M5 | Externer Lebenszeichen-Dienst, Uptime-Check, Testalarm | F-26 | offen, extern |
| TASK-023 | M5 | TwiML Bin je Nummer, Szenario 18 | F-09 | offen, extern |
| TASK-024 | M5 | Budget-Grenzen in den Anbieter-Konten | F-25 | offen, extern |
| TASK-026 | M5 | Versions-Tags, Rollback üben, Staging | – | teilweise (`deploy/deploy.sh` mit Tag, Backup, Smoke-Test, Rückweg, `a37f425`); Übung und Staging offen |
| TASK-028 | M5 | Support-Playbook, Release-Checkliste, Bereitschaft | – | teilweise (`docs/support-playbook.md`, `docs/release-checkliste.md`); Bereitschaft/Vertretung offen |
| TASK-029 | M5 | 2FA auf allen Betreiberkonten mit Nachweis | – | offen, extern (`docs/betreiber-konten.md`) |
| TASK-045 | M5 | Launch-Gate `--launch`, Soft Launch | – | offen (E-020) |
| TASK-046 | M5 | Testdaten aus Produktion, Feedback-Kanal | – | offen |
| TASK-047 | M5 | Landingpage, Vertragsweg, Onboarding-Checkliste | – | offen |
| TASK-049 | M5 | Externe Fachprüfung oder E-021 akzeptieren | – | offen (Entscheidung Inhaber) |
| TASK-050–TASK-060 | M6 | Ausbau nach dem Launch (Self-Service, Nummern per API, i18n, ausgehende Anrufe, Anbindungen, Abwesenheiten, Statusseite, RLS, Graph-Policy, Support-Zugriff, Aufräumen) | F-31–F-38 | offen – Einzelheiten in `21-roadmap.md` |

**Nächste Aufgabe für das Coding-Tool:** TASK-006 ist extern (Projektinhaber im GitHub-Konto). Danach TASK-008 und TASK-009 (fehlende HTTP- und E2E-Tests), dann M1-Restpunkte.

## Muss-Funktionen → Aufgaben

Alle Muss-Funktionen aus `docs/idea-to-app/05-mvp.md` sind gebaut; offen ist überwiegend der Nachweis.

| Muss-Funktion | Aufgaben | Offen |
|---|---|---|
| F-01 Anrufannahme | TASK-001, TASK-007, TASK-010, TASK-011, TASK-061, TASK-062 | Echttest je Anbieter |
| F-02 KI-Offenlegung | TASK-010, TASK-033 | Testanruf, E-010 |
| F-03 Verifizierte Anrufernummer | TASK-001, TASK-010, TASK-011 | Testanruf |
| F-04 Anliegen aufnehmen | TASK-002, TASK-010 | Testanruf |
| F-05 Termine buchen | TASK-010, TASK-016 | Testanruf, Verifizierung Google/Microsoft |
| F-07 Notfall | TASK-003, TASK-010, TASK-065 | Testanruf, `transfer_call` |
| F-08 Rückruf-Vorgang | TASK-010 | Testanruf |
| F-09 Fallback / Ersatzziel | TASK-010, TASK-023 | TwiML Bin je Nummer |
| F-10 Benachrichtigungen | TASK-003, TASK-017, TASK-039, TASK-065 | SPF/DKIM, Rechtsgrundlage SMS |
| F-12 Hub | TASK-009 | E2E |
| F-13 Anrufliste und Aufnahme | TASK-009 | E2E |
| F-14 Kundenverwaltung, DSGVO | TASK-008, TASK-009, TASK-036 | HTTP/E2E, Produktion |
| F-15 Team und Einsatzgebiete | TASK-009 | E2E |
| F-16 Einstellungen | TASK-009 | E2E |
| F-18 Konten und Zugang | TASK-008, TASK-009, TASK-041, TASK-066 | Restliche HTTP-Tests |
| F-19 Protokolle | TASK-009 | E2E |
| F-20 Tarif und Verbrauch | TASK-014 | – |
| F-21 Plattform-Verwaltung | TASK-008, TASK-009, TASK-059 | HTTP/E2E |
| F-22 Pakete | TASK-009, TASK-015, TASK-033 | Feature „Aufzeichnung“ (E-010) |
| F-23 Abrechnung | TASK-004, TASK-025, TASK-027 | Kosten je Anbieter, echte Rechnungen |
| F-24 Verbindungen | TASK-005, TASK-009 | E2E |
| F-25 Kostenschutz | TASK-013, TASK-014, TASK-024, TASK-062 | Anbieter-Budgets |
| F-26 Überwachung | TASK-022 | externer Dienst |
| F-27 Löschfristen, Offboarding | TASK-004, TASK-012, TASK-036 | Anbieter-Löschung belegen |
| F-28 Backups | TASK-021 | Produktion |
