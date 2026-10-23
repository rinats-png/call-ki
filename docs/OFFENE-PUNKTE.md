# Offene Punkte (Stand 2026-10-23)

Gemeinsame Merkliste. Erledigtes bitte hier abhaken oder streichen.

## Produkt
- [ ] **Test mit echten Konten** (Retell, Vapi, ElevenLabs, Twilio, Google). Zu bestätigen mit echten Anrufen:
  - Wie ElevenLabs Webhook-Tools die Daten genau schicken (Hüllenformat vs. flacher Body; `call_sid`/`called_number`/`caller_id` je Tool als Felder anlegen).
  - Ob bei Vapi die Kopfzeile `x-call_ref` im SIP-URI von Twilio durchgereicht wird.
- [ ] **Echte Rechnungen**: Rechnungsnummern, PDF, Zahlung (Lastschrift/Karte), Mahnwesen, Anbindung lexoffice/sevDesk. Bisher nur Vorschau + CSV.
- [ ] **Warnungen** bei 80 % und 100 % des Kontingents (E-Mail an Kunde und Admin).
- [ ] **Paket-Grenzen durchsetzen**: max. Rufnummern und Zugänge prüfen; Paketwechsel und „Mehr Minuten buchen“ klickbar machen.
- [ ] **Rufnummern in der Oberfläche kaufen/portieren**; sipgate direkt anbinden.
- [ ] **Ausgehende Anrufe**: Rückrufe, Terminerinnerungen, Kampagnen.
- [ ] **Weitere Anbindungen**: Apple-/CalDAV-Kalender, CRM (HubSpot, Pipedrive), Webhooks für Kunden.
- [ ] **Stimme und Sprache je Kunde** in der Oberfläche wählen (auch Englisch, Türkisch).
- [ ] **Überwachung & Alarme**, Statusseite.
- [ ] **Gemeinsamer Speicher für die Anfrage-Begrenzung** (Redis o. ä.) – auf Netlify (mehrere Instanzen) greift sie sonst unzuverlässig.
- [x] Design 17 (Mint auf Glas) umgesetzt: Admin mit Glas-Seitenleiste + Kunden-Kontingent, Kunde mit Verbrauchs-Hero und schwebender Navigation. Offen: restliche Unterseiten (Kunden, Team, Einstellungen) nutzen bereits die neuen Farben und Karten, bekommen aber noch kein eigenes Layout.

## Recht
- [ ] AVV/DPA mit Vapi und ElevenLabs (und weiteren gewählten Anbietern) abschließen, in `docs/recht/unterauftragsverarbeiter.md` eintragen.
- [ ] Aufzeichnung nach Variante C (ausdrückliche Einwilligung) bauen, bevor sie für Kunden aktiviert wird.
- [ ] Alle `[PRÜFEN]`-Stellen in `docs/recht/` von Fachperson klären lassen.

## Betrieb
- [ ] Verschlüsselungsschlüssel und Geheimnisse auf Netlify liegen als sichtbare Variablen – für die Testumgebung ok, im Echtbetrieb (IONOS-VPS) in die `.env`.
- [ ] Externe, verschlüsselte Backups + Wiederherstellungstest; Twilio-Ersatzziel (TwiML Bin) einrichten.
- [ ] Dependabot-Major-Updates (Prisma 7, Next 16, TypeScript 7, Tailwind 4) später gezielt.

## Später / Option
- [ ] Lokale Sprach-KI auf eigenem GPU-Server (Whisper + LLM + TTS über Pipecat/LiveKit) – lohnt erst ab mehreren tausend Minuten/Monat.
