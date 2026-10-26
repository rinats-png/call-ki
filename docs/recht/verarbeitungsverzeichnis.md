# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

> **Keine Rechtsberatung.** Teil A: Betreiber als **Verantwortlicher** (Art. 30 Abs. 1). Teil B: Betreiber als **Auftragsverarbeiter** (Art. 30 Abs. 2). Stand: 2026-10-24 (ergänzt: Vapi, ElevenLabs, Google, Microsoft, S3-Backup, Erinnerungen, Kontingent-Warnungen, Überwachung, Twilio-Gesprächsende, Aufbewahrung ↔ Löschung).

**Verantwortlicher / Auftragsverarbeiter:** `<Betreiber, Anschrift, Kontakt>`
**Datenschutzbeauftragter:** `<Name/Kontakt oder „nicht benannt – Pflicht geprüft am …“>` **[PRÜFEN: § 38 BDSG – Pflicht u. a. bei Verarbeitungen, die einer DSFA unterliegen]**

## Teil A – Eigene Verarbeitungen (Verantwortlicher)

### A1 Portal-Konten und Anmeldung
| Feld | Inhalt |
|---|---|
| Zweck | Zugang zum Kunden- und Admin-Portal, Absicherung (2FA), Missbrauchsschutz |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b (Vertrag mit dem Kunden; für Nutzer des Kunden: lit. f, berechtigtes Interesse an sicherer Bereitstellung) **[PRÜFEN]** |
| Betroffene | Plattform-Admins, Nutzer der Kunden |
| Daten | Name, E-Mail, Passwort-Hash, 2FA-Geheimnis (verschlüsselt), Wiederherstellungscodes (gehasht), Sitzungen (Token-Hash, Browser-Kennung/User-Agent, Zeitpunkte; keine IP-Adresse), Rolle; Anfrage-Zähler für Rate-Limits (`RateLimitHit`: SHA-256-Hash aus z. B. IP-Adresse oder E-Mail, Zeitfenster, Anzahl) |
| Empfänger | IONOS (Hosting, verschlüsselte Backups im IONOS Object Storage/S3), SMTP-Anbieter (Einladung, Reset), Have I Been Pwned (nur 5 Zeichen eines Passwort-Hashes, kein Personenbezug) |
| Drittland | nein (abhängig vom SMTP-Anbieter) |
| Löschung | Sitzungen nach Ablauf; Konto bei Entfernung bzw. Vertragsende; Token 7 Tage nach Ablauf; Rate-Limit-Zähler nach 2 Tagen |
| TOM | `toms.md` |

### A2 Sicherheits- und Audit-Protokoll
| Feld | Inhalt |
|---|---|
| Zweck | Nachweis von Admin-Aktionen, Zugriffen auf Inhalte (Mandantenwechsel, Aufnahmen, Export), Erkennen von Angriffen |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. c i. V. m. Art. 5 Abs. 2, Art. 32 DSGVO; lit. f |
| Daten | Nutzer-ID, Aktion, Objekt-ID, Zeitpunkt, Zusatzangaben ohne Inhaltsdaten |
| Löschung | 2 Jahre |

### A3 Kunden- und Vertragsverwaltung, Abrechnung
| Feld | Inhalt |
|---|---|
| Zweck | Vertragsschluss, Abrechnung nach Minuten/Tarif, Durchsetzung der Paketgrenzen, **Kontingent-Warnungen** (E-Mail an die Kunden-Admins bei 80 %/100 %, Hinweis an den Betreiber), Support |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b, c (Aufbewahrungspflichten) |
| Daten | Firma, Ansprechpartner, Kontaktdaten, Vertrags- und AVV-Stand, Paket, Nutzungsminuten (Grundlage: **Gesprächsdauer laut Twilio-Statusmeldung** `twilioDurationSec`, sonst laut KI-Anbieter), SMS-Anzahl, Rechnungen, Support-Korrespondenz |
| Empfänger | Buchhaltung/Steuerberatung `<…>`, Zahlungsanbieter `<…>`, SMTP-Anbieter (Warn-E-Mails), IONOS (Hosting, Backup) |
| Löschung | Rechnungen 8 Jahre, Handelsbriefe 6 Jahre, Bücher/Jahresabschlüsse 10 Jahre (Stand 2026 **[PRÜFEN]**); Regel zum Verhältnis zu den Löschfristen der Anrufe: `loeschkonzept.md` Abschnitt 5 |

### A4 Website des Betreibers
| Feld | Inhalt |
|---|---|
| Zweck | Information, Kontaktaufnahme |
| Daten | Server-Logs (IP, Zeit, URL) über Caddy, Kontaktanfragen |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f; § 25 Abs. 2 TDDDG (technisch notwendige Cookies: nur Sitzungscookie im Portal, kein Tracking) |
| Löschung | Logs `<N>` Tage **[PRÜFEN]** |

### A5 Betriebsüberwachung und Alarme
| Feld | Inhalt |
|---|---|
| Zweck | Ausfälle, nicht zugestellte Notfall-Alarme, fehlgeschlagene Backups, Kostenauffälligkeiten erkennen und den Betreiber benachrichtigen (`/api/cron/monitor`, `/api/cron/usage`) |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f (sicherer, verfügbarer Betrieb) und lit. c i. V. m. Art. 32 DSGVO |
| Betroffene | Plattform-Admins (Empfänger), mittelbar Mandanten |
| Daten | Befund (Titel, Stufe, Zeitpunkt), Mandantenname, Anbieter, gekürzte Fehlermeldungen der Versanddienste (können eine Empfängeradresse enthalten **[PRÜFEN]**), Verbrauchszahlen; **keine** Gesprächsinhalte und keine Anrufernummern |
| Empfänger | SMTP-Anbieter (`ALERT_EMAIL`), Twilio (SMS an `ALERT_SMS`), Ziel von `ALERT_WEBHOOK_URL` (z. B. Chat-Dienst – vor Einsatz prüfen und eintragen **[PRÜFEN]**), externer Lebenszeichen-Dienst (`HEALTHCHECK_PING_URL`, erhält nur die Befund-Titel) |
| Drittland | abhängig vom gewählten Lebenszeichen-/Chat-Dienst **[PRÜFEN]** |
| Löschung | Alarmzustand (`SystemState`) wird überschrieben; versandte Alarme im Nachrichtenprotokoll (`Message`, ohne Mandant) – Löschfrist **[PRÜFEN: Löschjob erfasst bisher nur Nachrichten mit Mandant]** |

### A6 Datensicherung
| Feld | Inhalt |
|---|---|
| Zweck | Wiederherstellbarkeit (Art. 32 Abs. 1 lit. c DSGVO) |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. c, f; für Mandantendaten Teil der Auftragsverarbeitung (Teil B) |
| Daten | vollständiger Datenbankauszug (alle Plattformdaten), mit age verschlüsselt |
| Empfänger | IONOS (VPS, lokal 14 Tage) und IONOS Object Storage (S3-kompatibel, Region Deutschland **[PRÜFEN]**, 30 Tage) bzw. der in `BACKUP_S3_ENDPOINT` eingetragene Anbieter |
| Löschung | rollierend: lokal 14 Tage, extern 30 Tage; monatlicher Wiederherstellungstest in einer Wegwerf-Datenbank, danach gelöscht |

## Teil B – Verarbeitungen im Auftrag (Art. 30 Abs. 2)

| Feld | Inhalt |
|---|---|
| Auftraggeber (Verantwortliche) | alle Mandanten der Plattform – Liste im Plattform-Admin (Name, Ansprechpartner, AVV-Version und -Datum) |
| Kategorien von Verarbeitungen | KI-Telefonannahme (Sprach-KI je Mandant: Retell, Vapi oder ElevenLabs), Anliegen- und Terminverwaltung inkl. Verschieben/Absagen per Telefon, Abgleich und Eintrag im Kalender des Kunden (interner Kalender, Google Kalender oder Microsoft 365 des Kunden), Benachrichtigungen (Bestätigung, Technikerinfo, Notfall-Alarm, **Terminerinnerungen** per E-Mail/SMS), Erfassung von Gesprächsende und -dauer über die **Twilio-Statusmeldung** (Abrechnung, Schließen hängender Anrufe, Löschung beim Anbieter), optional Aufzeichnung mit Einwilligungsabfrage, **Rückfrage „Passt es noch?“ per SMS mit Auswertung der Antwort**, **„Techniker ist unterwegs“ und Bitte um Bewertung** (je abschaltbar), **Techniker-App** (Einsatzbericht mit Befund, Fotos, Material, Kundenunterschrift), **Angebote, Rechnungen und Gutschriften an Endkunden** (Anschrift, Positionen, Zahlungsstatus), Datensicherung (Details: AVV Anlage 1) |
| Unterauftragsverarbeiter | `unterauftragsverarbeiter.md` |
| Unterauftragsverarbeiter (Kurzfassung) | IONOS (Hosting, Backup-Speicher S3), Twilio, je nach Kunde Retell / Vapi / ElevenLabs, SMTP-Anbieter. **Nicht** Unterauftragsverarbeiter: Google und Microsoft, wenn der Kunde sein eigenes Konto verbindet (Vertrag zwischen Kunde und Google bzw. Microsoft); die Plattform speichert dabei nur den verschlüsselten Google-Refresh-Token bzw. die Microsoft-Tenant-ID |
| Drittlandübermittlungen | USA (Twilio: BCR/SCC; Retell: SCC + TIA; Vapi: SCC **[PRÜFEN]**; ElevenLabs: SCC bzw. EU-Datenresidenz **[PRÜFEN]**); Google/Microsoft nach dem Vertrag des Kunden |
| TOM | `toms.md` |
