# Offene Punkte (Stand 2026-10-24)

Gemeinsame Merkliste. Erledigtes bitte hier abhaken oder streichen.

## Produkt
- [ ] **Test mit echten Konten** (Retell, Vapi, ElevenLabs, Twilio, Google). Zu bestätigen mit echten Anrufen:
  - Wie ElevenLabs Webhook-Tools die Daten genau schicken (Hüllenformat vs. flacher Body). `call_sid` muss als Dynamic Variable `system__call_sid` kommen – ohne passenden laufenden Anruf lehnt die Plattform den Aufruf ab.
  - SIP-Anbieter: Feld `call_ref` aus der Kopfzeile `X-Call-Ref` in jedem Tool-Aufruf mitschicken.
  - Ob bei Vapi die Kopfzeile `x-call_ref` im SIP-URI von Twilio durchgereicht wird.
- [ ] **Echte Rechnungen**: Rechnungsnummern, PDF, Zahlung (Lastschrift/Karte), Mahnwesen, Anbindung lexoffice/sevDesk. Bisher nur Vorschau + CSV.
- [x] **Warnungen** bei 80 % und 100 % des Kontingents, Kostenschutz (gleichzeitige Anrufe, Gesprächsdauer, Tagesbudget, Notschalter) – `docs/betrieb.md`.
- [x] **Paket-Grenzen durchsetzen**: Zugänge, Rufnummern, Terminbuchung, E-Mail-Benachrichtigungen, Notfall-Durchstellung, eigene Begrüßung & FAQ, eigener Agent. Offen: Aufzeichnung (hängt an der Entscheidung „Standard aus“), Paketwechsel und „Mehr Minuten buchen“ klickbar machen.
- [ ] **Rufnummern in der Oberfläche kaufen/portieren**; sipgate direkt anbinden.
- [x] **Terminerinnerungen** per E-Mail/SMS (Einstellungen → Benachrichtigungen).
- [ ] **Ausgehende Anrufe**: Rückrufe, Kampagnen.
- [ ] **Weitere Anbindungen**: Apple-/CalDAV-Kalender, CRM (HubSpot, Pipedrive), Webhooks für Kunden.
- [ ] **Stimme und Sprache je Kunde** in der Oberfläche wählen (auch Englisch, Türkisch).
- [x] **Überwachung & Alarme** (`docs/betrieb.md`). Offen: öffentliche Statusseite.
- [ ] **Gemeinsamer Speicher für die Anfrage-Begrenzung** (Redis o. ä.) – auf Netlify (mehrere Instanzen) greift sie sonst unzuverlässig.
- [x] Glas-Design (Entwürfe G01–G13) umgesetzt: schwebende Icon-Leiste, Glasfenster mit Leuchten, rechte Spalte mit Profil, Schnellaktionen, Kontingent- bzw. Umsatz-Karte; Seitenköpfe mit Kennzahl-Pillen. Audio-Wellenform-Player bei Aufnahmen umgesetzt. Noch offen aus den Entwürfen: Wochen-Heatmap im Team, Schalter-Ansicht für das Telefonverhalten, Upgrade-Kandidaten, Dienst-Status bei Verbindungen.

## Recht
- [ ] AVV/DPA mit Vapi und ElevenLabs (und weiteren gewählten Anbietern) abschließen, in `docs/recht/unterauftragsverarbeiter.md` eintragen.
- [ ] Aufzeichnung nach Variante C (ausdrückliche Einwilligung) bauen, bevor sie für Kunden aktiviert wird.
- [ ] Alle `[PRÜFEN]`-Stellen in `docs/recht/` von Fachperson klären lassen.

## Betrieb
- [ ] Verschlüsselungsschlüssel und Geheimnisse auf Netlify liegen als sichtbare Variablen – für die Testumgebung ok, im Echtbetrieb (IONOS-VPS) in die `.env`.
- [x] Externe, verschlüsselte Backups mit monatlichem Wiederherstellungstest und Twilio-Ersatzziel sind gebaut (`docs/betrieb.md`). Offen: auf dem Produktionsserver einrichten (age-Schlüssel, S3-Bucket, TwiML Bin je Nummer) und den ersten Wiederherstellungstest dort nachweisen.
- [ ] IONOS-VPS aufsetzen und härten (`deploy/harden.sh`), externen Lebenszeichen-Dienst und Uptime-Check einrichten.
- [ ] Testanrufe nach `docs/testanrufe.md` je Anbieter, Ergebnisse eintragen; Launch-Gate `docs/idea-to-app/23-launch.md`.
- [ ] Dependabot-Major-Updates (Prisma 7, Next 16, TypeScript 7, Tailwind 4) später gezielt.

## Später / Option
- [ ] Lokale Sprach-KI auf eigenem GPU-Server (Whisper + LLM + TTS über Pipecat/LiveKit) – lohnt erst ab mehreren tausend Minuten/Monat.
