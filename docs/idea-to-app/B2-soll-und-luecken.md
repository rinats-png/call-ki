# Soll & Lücken

> B2 im Modus „Bestehende App“, Stand 2026-10-24 (nach Commit `f605d85`; dazu ein noch nicht committeter Arbeitsstand zu Aufzeichnungs- und SMS-Einwilligung und zur Schlüsselrotation). Grundlage: `B1-ist-analyse.md` (Befunde `BF-…`, Stand 2026-10-23) und das Audit vom 2026-10-24 (Punkte `OP-xx-yy`). Jeder Status wurde gegen den Code bzw. die Commits geprüft; „unbelegt“ heißt: gebaut, aber nicht mit echten Konten oder auf dem Produktionsserver nachgewiesen.

## Ziel
Die Plattform an die ersten zahlenden Betriebe verkaufen – zuerst als Soft Launch mit 1–2 Pilotbetrieben (E-020, offen). Dafür: (1) alle hohen Befunde behoben oder bewusst akzeptiert, (2) die Kernfunktion F-01 bis F-09 mit echten Anrufen je Anbieter belegt, (3) Produktionsbetrieb mit Backups, Ersatzziel und Alarmen nachgewiesen, (4) Verträge und Pflichttexte vorhanden. Neue Funktionen (F-29 ff. in `05-mvp.md`) erst danach.

## Ist → Soll
| Bereich | Ist (B1 + Commits 2026-10-24) | Soll | Bezug |
|---|---|---|---|
| Telefon-KI: Datenzugriff | Kundendaten nur zur verifizierten Anrufernummer, Tools nur für laufende Anrufe, Geheimnis je Anbieter (Tests grün) | wie Ist + Nachweis mit echten Payloads je Anbieter | E-005, E-009, OP-14-01–03, OP-19-02 |
| Telefon-KI: Echtbetrieb | Nur synthetische Payloads; Retell-Signatur, ElevenLabs-Hülle, Vapi `x-call_ref` unbestätigt | Testanruf-Protokoll (`docs/testanrufe.md`, 20 Szenarien) je Anbieter mit Datum und CallSid | BF-17, OP-15-01, OP-19-06 |
| Agent-Konfiguration | Kundentypen in `voice-agent/tools.json` = Server (`BUSINESS`, Test vorhanden); Agent per Copy-Paste eingerichtet | Einrichtung per API, Prompt-Version am Anruf | OP-15-02, F-37 |
| Benachrichtigungen | Außerhalb des Gesprächs, bis zu 5 Wiederholungen, Alarm bei Notfall-Fehlschlag | wie Ist + Zustellbarkeit (SPF/DKIM/DMARC) nachgewiesen | E-011, OP-15-09 |
| Gesprächsende / Abrechnung | Twilio-Statusmeldung als Grundlage, hängende Anrufe werden geschlossen | wie Ist + echte Rechnungen, Zahlung | E-006, OP-15-04, OP-20-12, F-30 |
| Kosten | Notschalter, gleichzeitige Anrufe, Höchstdauer, Tagesbudget, Kontingent-Warnungen | wie Ist + Budget-Grenzen in den Anbieter-Konten + belegte Kostenrechnung | E-014, OP-15-08, OP-17-01 |
| Paketgrenzen | Serverseitig durchgesetzt (Zugänge, Nummern, Features) | Feature „Aufzeichnung“ an E-010 koppeln; Self-Service später | OP-05-05, F-22 |
| Aufzeichnung | Standard: aufzeichnen **mit** Ansage; Variante C (ausdrücklich fragen) in Arbeit | Standard „aus“ (E-010) bis Rechtsklärung; Variante C fertig und belegt | BF-04, OP-16-06, F-29 |
| Betrieb | Härtungsskript, verschlüsselte externe Backups, monatlicher Restore-Test, Überwachung, TwiML-Bin-Anleitung – alles gebaut, nichts auf Produktion | Produktionsserver eingerichtet, Nachweise (ufw/sshd/fail2ban, Restore-Test, Lebenszeichen, TwiML Bin je Nummer) mit Datum | BF-08, BF-09, OP-20-01–05 |
| Auslieferung | `git pull && docker compose up -d --build` auf dem Server; kein Staging, Rollback nicht geübt | Versions-Tags, Rollback einmal geübt | BF-22, OP-20-07 |
| Schlüssel | `APP_ENCRYPTION_KEY` mit Schlüssel-ID und Rotation (Arbeitsstand, nicht committet) | committet, getestet, Incident-Plan korrigiert | OP-14-07, OP-20-09 |
| Repository | laut Audit öffentlich, kein Branch-Schutz, Dependabot-Sicherheitsupdates aus; CI grün (Lauf `40065897007`) | privat (oder bewusst öffentlich), `main` geschützt, Pflicht-Checks | E-022, OP-13-02, OP-14-10 |
| Recht | Vorlagen in `docs/recht/` (VVT, TOM, AVV, DSFA, Löschkonzept, Datenschutz, Impressum, Incident-Plan, KI-VO); 54 PRÜFEN-Markierungen; AVVs nicht abgeschlossen; Vapi/ElevenLabs/Google teils nicht nachgetragen | AVVs datiert, Fachprüfung erledigt, Impressum/Datenschutz veröffentlicht, AGB/SLA final | BF-07, OP-16-01–09 |
| Tests | Unit- und Integrationstests (Postgres) in CI; keine HTTP-Tests je Endpunkt, keine E2E-Tests | Rückverfolgungsmatrix `19-tests.md`, HTTP- und E2E-Tests in CI | BF-11, OP-19-03–05 |
| Barrierefreiheit | `lang="de"`, sichtbarer Fokus, „Bewegung reduzieren“, ARIA in der Navigation; Kontrast des Glas-Designs ungeprüft | Basis-Checkliste WCAG 2.2 AA geprüft (`10-barrierefreiheit.md`) | BF-18, OP-10-01, OP-10-02 |
| Dokumentation | idea-to-app-Dokumente bis 2026-10-24 nur B1 und 23 | vollständiger Satz unter `docs/idea-to-app/` | OP-00-01, OP-00-02 |

## Befunde: Entscheidung
| Befund | Schweregrad | Entscheidung | Bezug |
|---|---|---|---|
| BF-01 | hoch | behoben (TOTP, Pflicht für Plattform-Admin) | `tests/totp.test.ts`, E-018 |
| BF-02 | hoch | behoben; seit 2026-10-24 gemeinsam in PostgreSQL | E-012, `tests/rate-limit.test.ts` |
| BF-03 | hoch | technisch behoben; **Echtnachweis offen** | TASK-012 |
| BF-04 | hoch | technisch behoben (keine stille Aufzeichnung); **Standard und Rechtslage offen** | E-010, TASK-033, TASK-034 |
| BF-05 | hoch | akzeptiert bis 2026-11-15, dann Major-Update | E-003, TASK-040 |
| BF-06 | hoch | behoben (CI grün, Lauf `40065897007`); Branch-Schutz offen | E-022, TASK-006 |
| BF-07 | hoch | in Arbeit – Vorlagen vorhanden, Abschluss/Prüfung offen | TASK-030, TASK-031, TASK-032 |
| BF-08 | mittel | gebaut; externer Lebenszeichen-Dienst offen | TASK-022 |
| BF-09 | mittel | gebaut; Nachweis auf Produktion offen | TASK-021 |
| BF-10 | mittel | gebaut (Kostenschutz, Warnungen); Kostenrechnung offen | E-014, TASK-024, TASK-025 |
| BF-11 | mittel | beheben | TASK-008, TASK-009 |
| BF-12 | mittel | behoben | `docs/sicherheit.md` „Sitzungen“ |
| BF-13 | mittel | akzeptiert | E-004 |
| BF-14 | mittel | behoben | `tests/pwned.test.ts` |
| BF-15 | mittel | behoben (Gesamtexport und Löschung eines Mandanten); Prüfung auf Produktion offen | TASK-036 |
| BF-16 | mittel | in DSFA aufnehmen | TASK-032 |
| BF-17 | mittel | beheben (Echttest je Anbieter) | TASK-010, TASK-011 |
| BF-18 | mittel | beheben (Phase 10 verkürzt) | TASK-042 |
| BF-19 | niedrig | akzeptiert | E-001 |
| BF-20 | niedrig | behoben | `src/lib/http.ts` |
| BF-21 | niedrig | behoben | `tests/rate-limit.test.ts` |
| BF-22 | niedrig | beheben vor Launch | TASK-026 |
| BF-23 | niedrig | behoben (Limit je Anrufer); Prompt-Regeln per Testanruf belegen | TASK-010 |

## Nachtrag: Audit-Punkte vom 2026-10-24 (Auswahl P0/P1)
| Punkt | Prio | Stand (gegen Code geprüft) | Bezug |
|---|---|---|---|
| OP-14-01 / OP-14-02 / OP-14-03 Fremddaten, Mandanten-Rückgriff, gemeinsames Geheimnis | P0/P1 | erledigt (Commit `8bdaa52`) | E-005, E-009 |
| Top 3 Kundentyp `B2B_HACCP` ↔ `BUSINESS` | P0 | erledigt; Konsistenztest „nutzt genau die Kundentypen, die der Server kennt“ | `tests/voice-auth.test.ts` |
| OP-15-03 Benachrichtigungen synchron | P1 | erledigt (Commit `4a1309e`) | E-011 |
| OP-15-04 / OP-20-12 StatusCallback, hängende Anrufe | P1 | erledigt (Commit `7175b50`) | E-006 |
| OP-14-05 / OP-17-02 / OP-05-03 Kostenschutz, Warnungen | P1 | erledigt (Commit `cbcdb54`) | E-014 |
| OP-05-05 Paketgrenzen | P1 | erledigt bis auf Feature „Aufzeichnung“ (Commit `91e56ea`) | E-010 |
| OP-05-02 Terminerinnerungen | P1 | erledigt, Standard aus (Commit `9a1d28d`) | E-008 |
| OP-05-04 Verschieben/Absagen per Telefon | P1 | erledigt (Commit `eb9dcbd`) | F-06 |
| OP-14-06 gemeinsame Rate-Limits | P1 | erledigt für sicherheitsrelevante Limits (Commit `136bc7f`) | E-002, E-012 |
| OP-14-11 Twilio-Signatur abschaltbar | P1 | erledigt (Commit `bc90bbd`) | E-013 |
| OP-18-04 Zeitumstellung | P1 | erledigt (Commit `0887e53`) | E-015 |
| OP-20-02 / OP-20-03 / OP-20-04 / OP-20-05 Härtung, Ersatzziel, Backups, Monitoring | P0 | gebaut (Commits `a338588`, `929c3ff`, `815c26c`, `9e3df2d`); **Einrichtung auf Produktion offen** | TASK-020–TASK-023 |
| OP-22-01 `.env.example` / OP-23-03 Fehlerseiten, robots.txt, Demo | P1 | erledigt (Commit `f605d85`) | E-019 |
| OP-14-07 Schlüsselrotation | P1 | in Arbeit (nicht committet) | TASK-005 |
| OP-15-01 / OP-18-02 / OP-19-02 / OP-19-06 Echttests, Latenz, Fixtures | P0 | offen | TASK-010, TASK-011 |
| OP-16-01 / 02 / 03 / 04 / 05 Verträge, Drittland, Fachprüfung, Impressum, AGB | P0 | offen | TASK-030, TASK-031, TASK-035 |
| OP-15-06 Google-/Microsoft-Verifizierung | P1 | offen | TASK-016 |
| OP-15-07 / OP-17-04 Rechnungen, Zahlung | P1 | offen | TASK-027 |
| OP-13-02 / OP-14-10 Repository, Branch-Schutz | P1 | offen (nicht im Code prüfbar) | E-022, TASK-006 |

## Ablauf
Phasen: 5, 6, 7, 10 (verkürzt), 11, 12, 13, 14, 15, 16 (in `docs/recht/`), 17, 18, 19, 20, 21, 22, 23. Übersprungen (B2): 1–4 (Produkt existiert; Validierung mit Pilotbetrieben läuft über E-020), 8 und 9 (Glas-Design ist umgesetzt; Kontrastprüfung in Phase 10), 24 (nach dem Launch).

Begründung: Ziel ist „Weiterentwickeln + Absichern“ (`B0-ziel.md`). Die Roadmap (`21-roadmap.md`) beginnt deshalb mit den offenen Nachweisen zu hohen Befunden (M-S), dann Absicherung und Tests (M0/M1), dann Echtbetrieb der Kernfunktion (M2). Unveränderliches aus B0 ist berücksichtigt: kein Stackwechsel, Twilio bleibt, Sprach-KI wählbar.
