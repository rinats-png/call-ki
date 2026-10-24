# Offene Punkte (Stand 2026-10-24, abends)

Gemeinsame Merkliste. Erledigtes bitte hier abhaken oder streichen.

## Produkt
- [ ] **Test mit echten Konten** (Retell, Vapi, ElevenLabs, Twilio, Google). Zu bestätigen mit echten Anrufen:
  - Wie ElevenLabs Webhook-Tools die Daten genau schicken (Hüllenformat vs. flacher Body). `call_sid` muss als Dynamic Variable `system__call_sid` kommen – ohne passenden laufenden Anruf lehnt die Plattform den Aufruf ab.
  - SIP-Anbieter: Feld `call_ref` aus der Kopfzeile `X-Call-Ref` in jedem Tool-Aufruf mitschicken.
  - Ob bei Vapi die Kopfzeile `x-call_ref` im SIP-URI von Twilio durchgereicht wird.
- [x] **Rechnungen**: fortlaufende Nummer je Jahr beim Monatsabschluss, eingefrorener Inhalt, Druck/PDF-Ansicht, E-Mail an Kunden-Admins, Rechnungsanschrift im Portal (Ausstellerdaten unter Plattform → Rechnungen eintragen).
- [ ] **Zahlung und Mahnwesen**: Lastschrift/Karte, Zahlungseingang, Mahnungen, Anbindung lexoffice/sevDesk; Sonderfälle (Kleinunternehmer, Reverse Charge) prüfen lassen.
- [x] **Warnungen** bei 80 % und 100 % des Kontingents, Kostenschutz (gleichzeitige Anrufe, Gesprächsdauer, Tagesbudget, Notschalter) – `docs/betrieb.md`.
- [x] **Paket-Grenzen durchsetzen**: Zugänge, Rufnummern, Terminbuchung, E-Mail-Benachrichtigungen, Notfall-Durchstellung, eigene Begrüßung & FAQ, eigener Agent. Offen: Aufzeichnung (hängt an der Entscheidung „Standard aus“).
- [x] **Mehr Minuten buchen** (Pakete +100/+250/+500, sofort wirksam) und **Paketwechsel anfragen** unter Tarif & Verbrauch; der Betreiber stellt unter Verwaltung → Abrechnung um.
- [ ] **Rufnummern in der Oberfläche kaufen/portieren**; sipgate direkt anbinden.
- [x] **Terminerinnerungen** per E-Mail/SMS (Einstellungen → Benachrichtigungen).
- [ ] **Ausgehende Anrufe**: Rückrufe, Kampagnen.
- [x] **Webhooks für Kunden** (signiert, Einstellungen → Integrationen) – darüber auch CRM/Zapier/Make.
- [ ] **Weitere Anbindungen**: Apple-/CalDAV-Kalender, direkte CRM-Anbindung (HubSpot, Pipedrive).
- [ ] **Stimme und Sprache je Kunde** in der Oberfläche wählen (auch Englisch, Türkisch).
- [x] **Überwachung & Alarme** (`docs/betrieb.md`) und öffentliche Statusseite `/status` (Hinweis über Plattform → „Hinweis auf der Statusseite“).
- [x] **Gemeinsamer Speicher für die Anfrage-Begrenzung**: sicherheitsrelevante Limits in PostgreSQL (`RateLimitHit`); API-/Webhook-Zähler bleiben im Prozess (E-002).
- [x] **Monatsabschluss** (GoBD): festgeschriebene Monatswerte, Löschung erst danach, Anonymisieren statt Löschen bei DSGVO-Löschung. Export für die Buchhaltung: Verwaltung → Abrechnung → CSV (festgeschriebene Werte, auch gelöschte Kunden).
- [x] **Notfall-Durchstellung** über Twilio durch den Server (Ziel nur aus den eigenen Daten). Beim Einrichten: `transfer_call` nur für Nummern ohne Twilio aktivieren und beim Anbieter auf feste Ziele beschränken.
- [ ] **Vertragstests mit echten Payloads** je Anbieter (`tests/fixtures/<anbieter>/`) nach den ersten Testanrufen.
- [ ] **Weiterleitung auf Mobilfunk** (Notfall-Durchstellung, Ersatzziel) kostet bei Twilio rund 33 ct/min und ist in den Paketen nicht eingepreist (`docs/idea-to-app/17-kosten.md`).
- [x] Glas-Design (Entwürfe G01–G13) umgesetzt: schwebende Icon-Leiste, Glasfenster mit Leuchten, rechte Spalte mit Profil, Schnellaktionen, Kontingent- bzw. Umsatz-Karte; Seitenköpfe mit Kennzahl-Pillen. Audio-Wellenform-Player bei Aufnahmen umgesetzt. Upgrade-Kandidaten (Abrechnung) und Dienst-Status (Integrationen) umgesetzt. Noch offen aus den Entwürfen: Wochen-Heatmap im Team, Schalter-Ansicht für das Telefonverhalten.

## Recht
- [ ] AVV/DPA mit Vapi und ElevenLabs (und weiteren gewählten Anbietern) abschließen, in `docs/recht/unterauftragsverarbeiter.md` eintragen.
- [x] Aufzeichnung nach Variante C (ausdrückliche Einwilligung) gebaut (Einstellungen → „Einwilligung zur Aufzeichnung“). Offen: Entscheidung Standard „aus“ (siehe unten).
- [ ] Alle `[PRÜFEN]`-Stellen in `docs/recht/` von Fachperson klären lassen.

## Betrieb
- [ ] Verschlüsselungsschlüssel und Geheimnisse auf Netlify liegen als sichtbare Variablen – für die Testumgebung ok, im Echtbetrieb (IONOS-VPS) in die `.env`.
- [x] Externe, verschlüsselte Backups mit monatlichem Wiederherstellungstest und Twilio-Ersatzziel sind gebaut (`docs/betrieb.md`). Offen: auf dem Produktionsserver einrichten (age-Schlüssel, S3-Bucket, TwiML Bin je Nummer) und den ersten Wiederherstellungstest dort nachweisen.
- [ ] IONOS-VPS aufsetzen und härten (`deploy/harden.sh`), externen Lebenszeichen-Dienst und Uptime-Check einrichten.
- [ ] Testanrufe nach `docs/testanrufe.md` je Anbieter, Ergebnisse eintragen; Launch-Gate `docs/idea-to-app/23-launch.md`.
- [ ] Dependabot-Major-Updates (Prisma 7, Next 16, TypeScript 7, Tailwind 4) später gezielt. `npm audit` meldet seit 2026-10-24 keine Schwachstelle mehr (zod 4, vitest 5, Overrides).
- [ ] 2FA auf allen Betreiberkonten nachweisen (`docs/betreiber-konten.md`), Branch-Schutz für `main`, Repository privat (E-022).
- [ ] Incident-Kontakte eintragen und einmal üben (`docs/recht/incident-plan.md`), Rollback einmal auf dem Server üben (`bash deploy/deploy.sh --rollback`), Support- und Feedback-Kanal festlegen (`docs/support-playbook.md`).
- [ ] Bereitschaft/SLA festlegen (wer reagiert nachts auf kritische Alarme?).
- [ ] Image-Registry und Staging-Server (heute wird auf dem Produktionsserver gebaut).

## Entscheidungen (vom Betreiber)
- [ ] **Aufzeichnung standardmäßig aus?** Heute: an, mit Ansage (E-010, `docs/recht/aufzeichnung.md`).
- [ ] **Frist für Vorgangstexte**: `CallTicket.summary`/`notes` (können Gesundheitsangaben enthalten) laufen heute nicht ab – eigene Frist oder bewusst als Geschäftsunterlage des Kunden behalten?
- [ ] **Privater Backup-Schlüssel auf dem Server**: nötig für den automatischen monatlichen Wiederherstellungstest; wer den Server übernimmt, kann damit auch ältere Backups lesen. Alternative: Schlüssel nur offline, Wiederherstellungstest von Hand auf einem anderen Rechner.
- [ ] **Risikostufe 3** statt 2 (Empfehlung aus `docs/idea-to-app/14-sicherheit.md`, E-017): dann externe Fachprüfung oder bewusst akzeptiertes Risiko vor dem Launch.

## Später / Option
- [ ] Lokale Sprach-KI auf eigenem GPU-Server (Whisper + LLM + TTS über Pipecat/LiveKit) – lohnt erst ab mehreren tausend Minuten/Monat.
