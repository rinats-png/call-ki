# Entscheidungen und akzeptierte Risiken

> **Maßgeblich ist `docs/idea-to-app/ENTSCHEIDUNGEN.md`** (vollständige Tabelle mit Begründung, Alternativen, Folgen und Bezügen; IDs werden nie neu vergeben). Für die bestehende App wird bewusst nicht kopiert, damit es nur eine Quelle gibt. Diese Übersicht hat den Stand 2026-10-24.
> Neue Entscheidungen trägt das Coding-Tool nur nach Zustimmung des Projektinhabers in `ENTSCHEIDUNGEN.md` ein (nächste freie ID nach E-023) und vermerkt sie in Paket-`docs/aenderungen.md`.

| ID | Status | Kurzfassung |
|---|---|---|
| E-001 | akzeptiert | CSP mit `'unsafe-inline'` (neu prüfen vor Launch, TASK-044) |
| E-002 | akzeptiert | Webhook-/API-Rate-Limits im Prozessspeicher |
| E-003 | akzeptiert | `npm audit`-Funde nur in Entwicklungswerkzeugen bis 2026-11-15 (TASK-040, TASK-064) |
| E-004 | akzeptiert | keine Postgres-RLS (vor 10 Kunden, TASK-057) |
| E-005 | gilt | ein Tool-Geheimnis je Sprach-KI-Anbieter |
| E-006 | gilt | Abrechnung nach Gesprächsdauer laut Twilio-Statusmeldung |
| E-007 | gilt | Ersatzziel bei Serverausfall als TwiML Bin bei Twilio je Nummer |
| E-008 | gilt | Terminerinnerungen standardmäßig aus |
| E-009 | gilt | Kundendaten nur zur verifizierten Anrufernummer; Tools nur für laufende Anrufe |
| E-010 | **offen** | Aufzeichnung standardmäßig aus (heute: an mit Ansage) |
| E-011 | gilt | Benachrichtigungen außerhalb des Gesprächspfads mit Wiederholung |
| E-012 | gilt | sicherheitsrelevante Rate-Limits gemeinsam in PostgreSQL |
| E-013 | gilt | Twilio-Signaturprüfung in Produktion nicht abschaltbar |
| E-014 | gilt | Kostenschutz mit Standardwerten (5/50 gleichzeitig, 20 min, Warnungen 80/100 %) |
| E-015 | gilt | Zeit in UTC speichern, Anzeige in Mandanten-Zeitzone |
| E-016 | gilt | Produktion auf einem IONOS-VPS mit Docker Compose; Netlify nur Test |
| E-017 | gilt | Risikostufe 2, Tendenz 3 |
| E-018 | gilt | scrypt statt Argon2id; 2FA Pflicht für Plattform-Admins |
| E-019 | gilt | Test-Kunde nur außerhalb der Produktion |
| E-020 | **offen** | Soft Launch mit 1–2 Pilotbetrieben |
| E-021 | **offen** | externe Fachprüfung oder bewusst akzeptiertes Risiko |
| E-022 | **offen** | Repository privat, Branch-Schutz für `main` |
| E-023 | gilt | SIP-Anbieter „nicht freigegeben“ |

Offene Entscheidungen (E-010, E-020, E-021, E-022) trifft nur der Projektinhaber – das Coding-Tool fragt nach, wenn eine Aufgabe davon abhängt.
