# Qualitätsziele

> Phase 18 im Modus „Bestehende App“. Messbare nicht-funktionale Anforderungen für Telefon-KI, Portal und Betrieb. Werte mit „Vorschlag“ sind vom Betreiber noch nicht bestätigt; Anbieter-Grenzen ohne Vertragsprüfung tragen `[PRÜFEN]`. Stand: 2026-10-24.
> **Kernaussage:** Fast keines der Ziele wird im Betrieb gemessen. Die App hat Timeouts und Grenzen eingebaut, aber keine Laufzeitmessung der Tool-Aufrufe in Produktion und keinen Latenztest mit echten Anbietern (OP-18-02). Seit 2026-10-24 gibt es einen **lokalen Lasttest** der Funktionsaufrufe gegen den Produktions-Build (`scripts/loadtest.ts`, Ergebnis unten); er ersetzt keine Messung mit echten Anbietern und Netzlatenz (OP-18-03 teilweise).

## Geräte & Plattformen

| Kanal | Zielgeräte |
|---|---|
| Portal (Kunden, Büro) | aktuelle Versionen von Chrome, Edge, Firefox, Safari auf Desktop; Mobil-Browser (iOS Safari, Android Chrome) für Startseite und Vorgänge |
| Verwaltung (Betreiber) | Desktop-Browser |
| Telefon | jedes Telefon (Festnetz, Mobil) über Rufumleitung auf eine Twilio-Nummer; Sprache Deutsch |

## Performance-Ziele

### Telefon-KI und Webhooks

| Ziel | Wert | Messung | Quelle / Annahme | Stand |
|---|---|---|---|---|
| Antwortzeit Funktionsaufruf (`/api/voice/tools`, ohne externe Kalender) | p95 < 1 s | Lasttest `scripts/loadtest.ts` (misst p50/p95/p99); in Produktion Dauer je Aufruf im Server-Log (fehlt: kein Zeitstempel/Dauer in `handle-tools.ts`) | Vorschlag; Sprechpausen über ~1 s wirken am Telefon störend `[PRÜFEN]` Anbieter-Empfehlung | **lokal belegt** (2026-10-24, Produktions-Build): p95 207/444/816 ms bei 10/30/60 gleichzeitigen Gesprächen, 0 Fehler; in Produktion nicht gemessen |
| Antwortzeit Funktionsaufruf mit Outlook/Google (`find_technician`, `book_appointment`, `reschedule_appointment`) | p95 < 3 s | wie oben | Vorschlag; Graph- und Google-Aufrufe haben 8 s Timeout (`src/lib/graph.ts`, `src/lib/google.ts`) – im schlechtesten Fall deutlich über dem Ziel | **nicht gemessen**, Risiko |
| Tool-Timeout des Anbieters | Ergebnis vor dem Timeout des Anbieters | Anbieter-Konfiguration der Tools | Retell/Vapi/ElevenLabs-Grenzen `[PRÜFEN]` | offen |
| Twilio-Webhook `/api/twilio/voice` (Anrufannahme bis TwiML) | p95 < 3 s, hart < 15 s | Twilio-Konsole (Request Inspector), Server-Log | Twilio wartet höchstens 15 s (Kommentar in `src/lib/voice/retell.ts`) `[PRÜFEN]`; Retell-Registrierung bricht nach 5 s ab, ElevenLabs nach 5 s → Fallback | Timeouts eingebaut, **nicht gemessen** |
| Vapi `assistant-request` | < 7,5 s, Ziel p95 < 2 s | Vapi-Call-Logs, Server-Log | Grenze laut Kommentar in `src/app/api/voice/vapi/route.ts` `[PRÜFEN]` | **nicht gemessen** |
| Sprach-Latenz im Gespräch | meist < 1,5 s, nach Funktionsaufruf < 3 s | Testanruf Szenario 19 in `docs/testanrufe.md` (Pausen stoppen) | eigener Zielwert [Q-026] | **offen** (kein Testanruf protokolliert) |
| Benachrichtigung an Mitarbeiter nach Buchung | < 1 min (E-Mail/SMS angestoßen) | `Message.createdAt` gegen `CallTicket.createdAt` | Vorschlag; Versand läuft direkt nach der Tool-Antwort (`runAfterResponse`) | im Integrationstest belegt („lässt die Sprach-KI nicht auf den Versand warten und versendet danach“), in Produktion nicht gemessen |
| Notfall-Alarm nicht zugestellt → Betreiber weiß Bescheid | < 10 min | Überwachung alle 5 min (`/api/cron/monitor`), Wiederholungen nach 1, 2, 5, 10 min | Vorschlag | im Integrationstest belegt („alarmiert bei nicht versendeten Notfall-Alarmen …“) |
| Maximale Gesprächsdauer | 20 min (2–120 einstellbar) | `timeLimit` an der SIP-Weiterleitung [Q-025], Cron-Abbruch jede Minute | `MAX_CALL_MINUTES`, E-014 | belegt (`tests/twilio-fallback.test.ts`, Integrationstest „beendet Gespräche über der Höchstdauer bei Twilio“) |

### Portal (Web)

| Ziel | Wert | Messung | Quelle / Annahme |
|---|---|---|---|
| LCP | ≤ 2,5 s | Labor: Lighthouse auf Login, Startseite, Anrufliste; Feld: nicht erfasst (kein RUM) | Core Web Vitals laut Regelwerk Phase 18 (Quelle Q-18a, in `QUELLEN.md` zu übernehmen) |
| INP | ≤ 200 ms | Labor: Lighthouse/Chrome DevTools | Regelwerk Phase 18 (Q-18b) |
| CLS | ≤ 0,1 | Labor: Lighthouse | Regelwerk Phase 18 (Q-18a) |
| API-Antwort Portal (Liste, Vorgang) | p95 < 500 ms | Server-Log, Lasttest | Vorschlag |
| Aktualität der Startseite | ≤ 5 s | Polling-Intervall `usePoll` 5 s (`src/lib/use-poll.ts`) | Code |

(Gemessen am 75. Perzentil, getrennt nach Mobil und Desktop; Messweg: Lighthouse-Lauf vor jedem Release in der Release-Checkliste, Verantwortlich: Betreiber. Heute gibt es keinen solchen Lauf.)

### Verfügbarkeit, Last, Wiederherstellung

| Ziel | Wert | Messung | Quelle / Annahme | Stand |
|---|---|---|---|---|
| Anrufannahme (Anruf landet bei KI, Fallback-Nummer oder Mailbox) | 99,9 % je Monat | Twilio-Logs: Anteil Anrufe mit Ergebnis; Ersatzziel (TwiML Bin) fängt Serverausfall ab | Vorschlag; hängt an Twilio-Verfügbarkeit `[PRÜFEN]` | Ersatzziel je Nummer **noch nicht gesetzt** (F-09); Überwachung erkennt fehlendes Ersatzziel |
| Verfügbarkeit Portal und KI-Pfad | 99,5 % je Monat (≈ 3,6 h Ausfall) | externer Uptime-Check auf `/api/health` + Lebenszeichen `HEALTHCHECK_PING_URL` | Vorschlag; ein VPS ohne Redundanz – mehr ist ohne zweite Instanz nicht seriös zusagbar | **nicht gemessen** (externer Dienst nicht eingerichtet) |
| Gleichzeitige Gespräche | 5 je Mandant, 50 gesamt (einstellbar) | Kostenschutz zählt laufende Anrufe (`src/lib/cost-guard.ts`); Lasttest `scripts/loadtest.ts` | Grenzen der Anbieter-Tarife (Retell, Vapi, ElevenLabs) und Twilio-CPS `[PRÜFEN]` | Grenze belegt (Integrationstest „lässt nur begrenzt viele gleichzeitige Anrufe zur KI …“); Server-Seite lokal mit 60 gleichzeitigen simulierten Gesprächen ohne Fehler belegt, Anbieter-Seite **nicht gemessen** |
| Server-Kapazität | 50 gleichzeitige Gespräche + Portal-Polling auf VPS 2 vCPU / 4 GB | Lasttest mit erfundenen Daten: Tool-Spitzen, Ereignisse bis 2 MB, 20 Portal-Nutzer mit 5-s-Polling | README (Mindestgröße VPS) | **teilweise:** Tool-Spitzen lokal belegt (60 gleichzeitig, p95 816 ms, 0 Fehler; lokaler Rechner, nicht VPS); Ereignisse bis 2 MB, Portal-Polling und Lauf auf dem VPS offen (OP-18-03) |
| RPO (maximaler Datenverlust) | 24 h | tägliches Backup ~02:00 UTC, Lebenszeichen an `/api/cron/heartbeat`, Alarm bei fehlendem Backup | `deploy/backup.sh` | Alarm belegt (Integrationstest), Produktion **nicht eingerichtet**; kürzer nur mit WAL-Archivierung/PITR |
| RTO (Wiederanlauf nach Totalausfall) | 4 h (neuer VPS, `harden.sh`, `.env` aus Tresor, Restore aus S3) | Wiederherstellungsübung mit Stoppuhr, Ergebnis mit Datum in `docs/betrieb.md` | Vorschlag | **nicht geübt**; monatlicher Restore-Test prüft nur die Lesbarkeit, nicht die Zeit |
| Datenhaltbarkeit Backups | lokal 14 Tage, extern 30 Tage | Bucket-Inhalt, Restore-Test monatlich | `docs/betrieb.md` | Skript vorhanden, Lauf in Produktion offen |
| Löschfrist | täglicher Lauf, je Mandant bis 200 Anrufe beim Anbieter je Lauf; Anrufzeilen erst nach Monatsabschluss (ab dem 3. des Folgemonats, Commit `48e363a`) | Ergebnis im Log `retention.done`, `providerFailed = 0`, `billing.months_closed` | `src/lib/services/retention.ts`, `src/lib/services/billing-close.ts` | Logik vorhanden; Anbieter-Löschung mit echtem Konto **nicht belegt** |

## Zeit, Datum & Formate

| Thema | Festlegung |
|---|---|
| Speicherung | UTC; Postgres-Typ `TIMESTAMP(3)` ohne Zeitzone, die App schreibt UTC (OP-11-04) |
| Zeitzone des Nutzers | je Mandant als IANA-Name (`Tenant.timezone`, Standard `Europe/Berlin`); Portal zeigt in deutscher Zeitzone (Commit `3ab1bd9`) |
| Anzeigeformat | Deutsch fest (`Intl.DateTimeFormat("de-DE")`, `formatGermanDateTime`) |
| Zeitspannen über Mitternacht | Geschäftszeiten und Termine innerhalb eines Tages; Termine über Mitternacht werden nicht angeboten |
| Zuordnung zum Kalendertag | Abrechnungsmonat und Tagesgrenzen in Ortszeit des Mandanten; Tagesbudget der Plattform in `Europe/Berlin` |
| Sommerzeit: fehlende / doppelte Stunde | Wanduhrzeit wird über `fromZoned` umgerechnet; Slots über die Umstellung zur richtigen Ortszeit |
| Wiederholungen | keine wiederkehrenden Termine |
| Geplante Jobs | `deploy/cron.sh` und `deploy/backup.sh` laufen in UTC (Alpine-Standard): Löschfristen 03:00 UTC, Backup ~02:00 UTC |
| Tests rund um Zeitumstellung | TEST-F05-2 (`tests/time.test.ts`: 25.10.2026, 29.03.2026, Monats- und Tagesgrenzen) |

## Offline

Nicht vorgesehen. Bei Ausfall des Servers nimmt das Ersatzziel bei Twilio Anrufe an (Weiterleitung oder Störungsansage); das Portal ist dann nicht erreichbar.

## Benachrichtigungen

| Anlass | Kanal | Häufigkeit | Abschaltbar | Text-Beispiel |
|---|---|---|---|---|
| Terminbestätigung an Anrufer | E-Mail (mit ICS), SMS (Paket `sms`) | je Buchung/Verschiebung | ja, je Mandant (`customerConfirmation`: aus/E-Mail/SMS/beides); Anrufer-Widerspruch per „STOP“ wird beachtet (`smsOptOutAt`) | „Terminbestätigung – Di., 27.10.2026, 09:00“ (Kategorie, Adresse, Vorgangsnummer – keine Zusammenfassung) |
| Neuer Vorgang an Mitarbeiter | E-Mail, SMS, Kalendereintrag | je Vorgang | ja, je Mandant (`technicianAlert`) | „[Hoch] Wasserschaden – Name (PLZ)“ mit Zusammenfassung (sensibel, BD-19) |
| Notfall-Alarm | SMS und/oder E-Mail | je Notfall, mit Wiederholung | je Mandant (`emergencyAlert`); geht auch ohne Paketfunktion raus | „NOTFALL …“ |
| Kopie ans Büro | E-Mail | je Vorgang | ja (`backofficeEmail` leer) | wie Mitarbeiter |
| Terminerinnerung an Anrufer | E-Mail/SMS | einmal vor dem Termin, nicht bei kurzfristigen Terminen | ja, Standard aus | neutral, ohne Inhalt |
| Kontingent 80 % / 100 % | E-Mail an Kunden-Admin und Betreiber | einmal je Schwelle und Monat | nein | „80 % Ihrer Freiminuten verbraucht“ |
| Betriebsalarm | E-Mail, SMS (nur kritisch), Webhook | entprellt (`SystemState`) | über Einstellungen | Alarmtitel ohne Inhaltsdaten |
| Einladung, Passwort-Reset | E-Mail | auf Anforderung | nein | Link mit Laufzeit |

Neutrale Texte: Kundenbestätigung und Erinnerung enthalten keine Freitext-Zusammenfassung. Mitarbeiter-E-Mail, Kalendereintrag und Büro-Kopie enthalten sie – das ist der offene Punkt BD-19/OP-18-05 (T-SEC-32).

Grenzen seit Commit `0e0efc5`: SMS gehen nur in freigegebene Länder (`SMS_ALLOWED_PREFIXES`, Standard `+49,+43,+41`); „Benachrichtigung erneut senden“ ist auf 5× je Vorgang in 24 h begrenzt.

## Last & Skalierung (Grobplanung)

| Annahme | Wert | Bestätigt (A-…) |
|---|---|---|
| Kunden im 1. Jahr | 5–20 Betriebe (Vorschlag) | nein – in `PROJECT_STATE.md` als Annahme aufnehmen |
| Anrufe je Kunde und Monat | 100–600 (Vorschlag) | nein |
| Gleichzeitige Gespräche in der Spitze | 10–20 plattformweit (Vorschlag), Grenze 50 | nein |
| Zeiten der Lastspitzen | Montagvormittag, nach Unwetter (Handwerk), Sommer (Wespen bei Schädlingsbekämpfung) | nein |

- **Engpässe:** Antwortzeit externer Kalender (bis 8 s), Tarifgrenzen der Sprach-KI-Anbieter, ein Node-Prozess mit Prozess-Rate-Limits, Postgres auf demselben VPS, Portal-Polling alle 5 s je offenem Browser.
- **Verhalten bei Überlast:** Kostenschutz schickt weitere Anrufe an die Fallback-Nummer bzw. Mailbox (nie „besetzt“ ohne Hinweis); Webhooks antworten mit `429`; Notschalter `AI_KILL_SWITCH`.
- **Auslöser für Neubewertung:** dauerhaft mehr als 20 gleichzeitige Gespräche, mehr als 10 Kunden (gleichzeitig mit E-004 RLS), Zusage einer Verfügbarkeit über 99,5 %, p95 der Funktionsaufrufe über 1 s.
- **Lasttest:** ☐ nicht nötig ☐ einfache Probe ☑ **vor Launch in Phase 19** (Latenz mit echten Anbietern und Lastprobe der Plattform, siehe `19-tests.md` TEST-F25-2).

**Ergebnis Lastprobe der Plattform (2026-10-24):** `scripts/loadtest.ts` gegen den Produktions-Build, lokal; je simuliertem Gespräch `identify_caller` → `save_customer` → `find_technician` → `book_appointment`.

| Gleichzeitige Gespräche | Fehler | p95 | Ziel |
|---|---|---|---|
| 10 | 0 | 207 ms | < 1 s |
| 30 | 0 | 444 ms | < 1 s |
| 60 | 0 | 816 ms | < 1 s |

Grenze: lokal, ohne echte Anbieter, ohne Netzlatenz, ohne externe Kalender. Bei 60 Gesprächen liegt p95 schon bei gut 80 % des Ziels – auf dem VPS (Mindestgröße 2 vCPU / 4 GB laut README) und mit Netzlatenz ist das Ziel damit nicht gesichert. Offen bleiben die Latenz mit echten Anbietern (TASK-062, Testanruf Szenario 19), Ereignisse bis 2 MB und Portal-Polling.

## Quellen & Annahmen

- Core-Web-Vitals-Schwellen: Regelwerk Phase 18, Einträge Q-18a und Q-18b – nach `QUELLEN.md` übernehmen (Agent A).
- Twilio-Timeout 15 s, Vapi-Grenze 7,5 s, Tarifgrenzen der Anbieter: nur aus Code-Kommentaren bzw. Anbieter-Doku übernommen, `[PRÜFEN]` vor dem Launch.
- Alle „Vorschlag“-Werte: vom Betreiber zu bestätigen und dann als Annahme/Entscheidung in `PROJECT_STATE.md` bzw. `ENTSCHEIDUNGEN.md` festzuhalten.
