# Projektstatus: KI-Telefonzentrale (call-ki)

> Gedächtnis des Projekts. Nach jeder Arbeitsrunde aktualisieren.
> Stand des Codes: Commit `33c0708` (2026-10-24). Seit dem ersten Dokumentstand behoben: Monatsabschluss/GoBD und Anonymisieren statt Löschen (`48e363a`), Produktionsabhängigkeiten ohne `npm audit`-Befund, CI ab „high“ (`859b8e0`), Sicherheitsbefunde aus der Dokumentprüfung (`0e0efc5`), HTTP-Tests T-SEC-HTTP-10…14 und Build-Scan (`33c0708`). Letzter lokaler Testlauf 2026-10-24: Unit 133, Integration 31/31, E2E 17/17 grün; Lasttest siehe `18-qualitaetsziele.md`.

| Feld | Wert |
|---|---|
| Slug | `call-ki` |
| Erstellt | 2026-10-23 |
| Zuletzt aktualisiert | 2026-10-24 |
| Einstieg | Bestehende App |
| Erfahrung | Entwickler |
| Arbeitsweise | Adaptiv |
| Umfang | Voll |
| Plattform | Web-App (Next.js 15, mandantenfähig) + Telefonkanal (Twilio → Retell / Vapi / ElevenLabs); Produktion auf IONOS-VPS mit Docker Compose, Testumgebung Netlify |
| Risikostufe | 2 – Grund: Konten, personenbezogene Daten Dritter (Anrufer), Sprachaufnahmen und Transkripte; Tendenz 3, weil Transkripte Gesundheitsangaben enthalten können (DSFA-Schwellwertprüfung offen, E-017) |
| Sprache | Deutsch |
| Regelwerk-Version | 1.2.0 |

## Aktueller Stand
- **Aktuelle Phase:** Dokumentation des Ist-Stands (B0–B2, 5–7, 10, 21 fertig; 11–20, 22 in Arbeit); 23 Launch „Nicht freigabefähig“.
- **Nächster Schritt:** Offene Entscheidungen E-010 (Aufzeichnung Standard aus), E-020 (Soft Launch), E-021 (externe Prüfung), E-022 (Repository privat) vom Inhaber treffen lassen; dann M-S/M0 aus `21-roadmap.md` (TASK-005, TASK-006, TASK-008).
- **Fortschritt:** ▓▓▓▓▓▓░░░░ 16 von 28 Phasen (inkl. B0–B2 und übersprungener Phasen)

## Fortschritt

Status: `offen` · `in Arbeit` · `fertig` · `übersprungen (<Grund>)` · `⚠️ prüfen` · `pausiert (<Bedingung>)` · `gestoppt (<Grund>)`

| Nr | Phase | Status | Datei |
|---|---|---|---|
| B0 | Ziel & Zugang | fertig | B0-ziel.md |
| B1 | Ist-Analyse | fertig (Stand 2026-10-23; Nachträge in B2-soll-und-luecken.md) | B1-ist-analyse.md |
| B2 | Soll & Lücken | fertig | B2-soll-und-luecken.md |
| 0 | Start & Einstellungen | übersprungen (Einstellungen stehen in dieser Datei) | 00-start.md |
| 1 | Idee & Problem | übersprungen (B2) | 01-idee.md |
| 2 | Idee validieren | übersprungen (B2 – Validierung über Pilotbetriebe, E-020) | 02-validierung.md |
| 3 | Zielgruppe | übersprungen (B2 – Kurzfassung in B0-ziel.md) | 03-zielgruppe.md |
| 4 | Markt & Wettbewerb | übersprungen (B2) | 04-markt.md |
| 5 | MVP-Umfang | fertig | 05-mvp.md |
| 6 | User-Flows | fertig | 06-flows.md |
| 7 | Screens & Navigation | fertig | 07-screens.md |
| 8 | Mockups | übersprungen (B2 – Glas-Design umgesetzt) | 08-mockups.md |
| 9 | Design-System | übersprungen (B2 – Kontrast in Phase 10) | 09-design.md |
| 10 | Barrierefreiheit & Sprachen | fertig (verkürzt; Prüfungen offen, TASK-042) | 10-barrierefreiheit.md |
| 11 | Daten & Inhalte | in Arbeit | 11-daten.md |
| 12 | Rollen & Berechtigungen | in Arbeit | 12-berechtigungen.md |
| 13 | Tech-Stack & Architektur | in Arbeit | 13-architektur.md |
| 14 | Sicherheitsarchitektur | in Arbeit | 14-sicherheit.md |
| 15 | Login, Zahlung, Integrationen | in Arbeit | 15-integrationen.md |
| 16 | Recht & Datenschutz | in Arbeit (Unterlagen in `docs/recht/`) | 16-recht.md |
| 17 | Monetarisierung & Kosten | in Arbeit | 17-kosten.md |
| 18 | Performance, Offline, Benachrichtigungen | in Arbeit | 18-qualitaetsziele.md |
| 19 | Qualität & Tests | in Arbeit | 19-tests.md |
| 20 | Betrieb | in Arbeit | 20-betrieb.md |
| 21 | Roadmap & Aufgaben | fertig | 21-roadmap.md |
| 22 | Build-Handoff | in Arbeit | handoff/AGENTS.md |
| 23 | Launch & Freigabe | in Arbeit (Nicht freigabefähig) | 23-launch.md |
| 24 | Iteration & Wartung | übersprungen (B2 – nach dem Launch) | 24-iteration.md |

## Kernentscheidungen (Kurzfassung – Details in ENTSCHEIDUNGEN.md)
- E-005 / E-009: Telefon-KI bekommt Kundendaten nur zur verifizierten Anrufernummer; ein Tool-Geheimnis je Anbieter.
- E-006: Abrechnung nach Gesprächsdauer laut Twilio.
- E-007: Ersatzziel bei Serverausfall als TwiML Bin bei Twilio.
- E-008: Terminerinnerungen standardmäßig aus.
- E-011 / E-012 / E-014: Benachrichtigungen asynchron mit Wiederholung; sicherheitsrelevante Rate-Limits in PostgreSQL; Kostenschutz mit Standardwerten.
- E-016: ein IONOS-VPS mit Docker Compose; Netlify nur Testumgebung.
- **Offen:** E-010 Aufzeichnung standardmäßig aus · E-020 Soft Launch · E-021 externe Fachprüfung · E-022 Repository privat.
- Akzeptierte Risiken: E-001 (CSP), E-002 (Rate-Limits im Prozess), E-003 (npm audit bis 2026-11-15 – seit `859b8e0` nur noch Entwicklungswerkzeuge, Produktion ohne Befund; Eintrag in `ENTSCHEIDUNGEN.md` nachziehen), E-004 (kein RLS).
- **Bewusst offen (Entscheidung bzw. Anbieter nötig):** `CallTicket.summary`/`notes` ohne automatische Frist · privater age-Schlüssel für den automatischen Wiederherstellungstest auf dem Server · `transfer_call` beim Anbieter auf feste Ziele beschränken · Kalender-/E-Mail-Inhalte (T-SEC-32) · Vertragstests mit echten Payloads (TEST-F01-4).

## Annahmen

> Jede `[ANNAHME A-…]` aus den Dokumenten steht hier. Bestätigt: `nein` / `ja` / `verworfen`.

| ID | Annahme | Phase | Bestätigt |
|---|---|---|---|
| A-001 | Kein fester Launch-Termin; Soft Launch, sobald M-S bis M4 erledigt sind | 5 | nein |
| A-002 | Zeitbudget pro Woche nicht festgelegt; Roadmap-Dauern sind Schätzungen | 5, 21 | nein |
| A-003 | Daten sollen möglichst in Deutschland/EU verarbeitet werden (IONOS, EU-Regionen der Anbieter, wo möglich) | B0 | nein |
| A-004 | Zielkunden sind kleine Betriebe in Deutschland (Schädlingsbekämpfung, Handwerk, Dienstleister) laut Branchenvorlagen | B0 | nein |
| A-005 | Anrufer sprechen Deutsch und sitzen in Deutschland; Zeitzone Europe/Berlin | B0, 10 | nein |
| A-006 | Eine eigene Sprach-KI auf GPU-Server lohnt erst ab mehreren tausend Minuten im Monat | 5 | nein |
| A-007 | Der Betreiber ist ein Kleinstunternehmen (unter 10 Beschäftigte, höchstens 2 Mio. € Umsatz) | B0, 10 | nein |
| A-008 | Wochenanfang Montag; Geschäftstage je Mandant wählbar | 10 | nein |
| A-009 | Kunden wollen Annahme rund um die Uhr (keine eigene Ansage „außerhalb der Geschäftszeiten“) | 6 | nein |
| A-011 | Der hohe `npm audit`-Fund in prisma 6 betrifft nur die CLI, nicht die Laufzeit (seit Commit `859b8e0` gegenstandslos: Override `deepmerge-ts`, `npm audit --omit=dev` ohne Befund) | 14 | nein |
| A-012 | Die Kostenschutz-Standardwerte (5 je Kunde, 50 gesamt, 20 min) passen zu den Tarifen der KI-Anbieter | 17 | nein |
| A-013 | Hub zeigt im Leerzustand einen Hinweis auf den ersten Testanruf; bei Verbindungsverlust bleibt der letzte Stand sichtbar (keine eigene Offline-Anzeige) – nicht im Browser geprüft | 6 | nein |
| A-014 | Mitarbeiter sehen Team (lesend) und Tarif; im Reiter „Protokoll“ (S20) sehen sie nur die versendeten Benachrichtigungen (`GET /api/messages`, ohne Inhalt). Das Aktivitätsprotokoll (`GET /api/audit`, `requireTenant({ adminOnly: true })`) sehen nur Kunden-Admins – die Seite `settings/activity` blendet es für Mitarbeiter aus (im Code geprüft 2026-10-24). Bearbeiten nur Kunden-Admin – Detailrechte in `12-berechtigungen.md` | 7 | nein (Teil „Protokoll“ im Code geprüft; Team/Tarif nicht im Browser geprüft) |
| A-015 | Für B2B genügt: Zugänge entfernt der Kunden-Admin, Mandanten löscht der Betreiber; kein Self-Service „eigenes Konto löschen“ | 7 | nein |
| A-016 | Fehlermeldungen im Portal erscheinen als Text, nicht nur farbig (stichprobenartig im Code, nicht im Browser geprüft) | 10 | nein |

> A-010 ist nicht vergeben. Andere Phasen-Dokumente (11–20, 22) tragen ihre Annahmen ab A-020 hier ein.

## Offene Fragen
- E-010: Soll die Aufzeichnung für alle Kunden standardmäßig aus sein? Heute: `announceRecording` = true (es wird aufgezeichnet und angesagt).
- E-020/E-021/E-022: Pilotbetriebe, externe Fachprüfung, Sichtbarkeit des Repositorys.
- B1 ist auf dem Stand 2026-10-23 (nur Retell); neue Anbieter (Vapi, ElevenLabs, Google) und die Audit-Punkte stehen in `B2-soll-und-luecken.md`. Soll B1 formal nachgetragen werden (OP-00-03)?
- BFSG beim Telefonkanal (`10-barrierefreiheit.md`, offene Prüfmarkierung).
- Repository-Sichtbarkeit und Branch-Schutz konnten nicht aus dem Code geprüft werden (Stand laut Audit 2026-10-24).

## Parkplatz (Ideen für später)
- Lokale Sprach-KI (Whisper + LLM + TTS über Pipecat/LiveKit) – F-40, erst ab großem Volumen.
- Offene Glas-Entwürfe: Wochen-Heatmap im Team, Schalter-Ansicht Telefonverhalten, Upgrade-Kandidaten, Dienst-Status bei Verbindungen (OP-05-12).
- Qualitätsmessung der KI-Gespräche: Abschlussquote, Rückruf-Anteil, Fehlklassifizierung der Dringlichkeit (OP-24-03).
- Wettbewerbsanalyse und Namenscheck „KI-Telefonzentrale“ (OP-04-01, OP-04-02).
