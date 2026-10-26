# Löschkonzept

> **Keine Rechtsberatung.** Beschreibt, wann welche Daten gelöscht werden und **wie das technisch passiert** (Belege im Code). Die Löschfrist für Gesprächsinhalte legt der Kunde als Verantwortlicher fest (Einstellungen → Datenschutz, 7–3650 Tage, Standard 365). Stand: 2026-10-24 (ergänzt: Vapi, ElevenLabs, Google, Microsoft, S3-Backup, Erinnerungen, Überwachung, Twilio-Gesprächsende; neu Abschnitt 5 Aufbewahrung ↔ Löschung).

## 1. Fristen

| Datenart | Wo | Frist / Auslöser | Umsetzung |
|---|---|---|---|
| Transkript, Zusammenfassung, Aufnahme-Link eines Anrufs | DB `Call` | `retentionDays` des Mandanten nach Anrufbeginn | täglicher Job `runRetention` setzt Felder auf leer |
| Aufnahme, Transkript, Anrufprotokoll **beim Anbieter** | Retell, Vapi, ElevenLabs, Twilio | wie oben (vorher) | `purgeCallAtProviders` (`src/lib/voice/providers.ts`): Retell `DELETE /v2/delete-call/{id}`, Vapi `DELETE /call/{id}`, ElevenLabs `DELETE /v1/convai/conversations/{id}`, Twilio Recording + Call löschen; bei Zero-Retention-Einstellung beim Anbieter entfällt die Speicherung dort von vornherein **[PRÜFEN: je Anbieterkonto aktivieren]**; Erfolg in `providerPurgedAt`; Fehlschläge werden am Folgetag wiederholt (max. 200 je Mandant und Lauf) |
| Anruf-Datensatz ohne Kundenbezug und ohne Vorgang (z. B. aufgelegt) | DB `Call` | `retentionDays`, nachdem beim Anbieter gelöscht | Job löscht den Datensatz vollständig |
| Anruf-Metadaten mit Kunden-/Vorgangsbezug (Nummer, Zeit, Dauer, Dauer laut Twilio-Statusmeldung `twilioDurationSec`, Ende-Grund) | DB `Call` | bis der Kunde den Endkunden löscht | Geschäftsdokumentation des Kunden **[PRÜFEN: eigene Frist sinnvoll?]**; Abrechnungsbezug siehe Abschnitt 5 |
| Hängende Anrufe (`RINGING`/`IN_PROGRESS` ohne Ende-Ereignis) | DB `Call` | werden nach dem Auflegen laut Twilio bzw. nach Höchstdauer + 30 Min. geschlossen (`endReason = no_provider_event`), danach gelten die normalen Fristen | Cron `/api/cron/calls` (`closeStaleCalls`) |
| Transkript im Vorgang | DB `CallTicket.transcript` | `retentionDays` | Job leert Feld |
| Vorgang (Kategorie, Termin, Zusammenfassung, Notizen) | DB `CallTicket` | bis der Kunde Endkunde/Vorgang löscht | Geschäftsdokumentation; Handels-/Steuerfristen liegen beim Kunden |
| Endkunde (Name, Nummer, Adresse) | DB `Customer` | auf Weisung (Löschung im Portal) oder Vertragsende | `eraseCustomer`: löscht Kunde, Vorgänge, Anrufe, Nachrichten – **zuerst bei Retell/Twilio**; meldet, falls die Anbieter-Löschung unvollständig war |
| Nachrichteninhalt (E-Mail/SMS-Text, auch **Terminerinnerungen** und Kontingent-Warnungen) | DB `Message.body` | `retentionDays` | Job leert Inhalt; Empfänger, Zweck, Status bleiben als Versandnachweis |
| Plattform-Alarme an den Betreiber (Nachrichten ohne Mandant, Zweck `PLATFORM_ALERT`) | DB `Message` (`tenantId` leer) | Vorschlag 90 Tage | **Lücke:** der Löschjob erfasst bisher nur Nachrichten mit Mandant **[PRÜFEN: Löschjob ergänzen]** |
| Alarm- und Jobzustand (letzte Meldung von Backup, zuletzt gesendete Alarme, gemeldete Kontingent-Schwellen) | DB `SystemState` | wird überschrieben; enthält keine Anruferdaten | – |
| Terminerinnerung versendet (Zeitpunkt) | DB `CallTicket.reminderSentAt` | mit dem Vorgang | – |
| Google-Kalender-Verbindung (verschlüsselter Refresh-Token, E-Mail des verbindenden Kontos) | DB `Integration` | bis der Kunde trennt bzw. Mandant gelöscht wird | Trennen widerruft den Token bei Google (`src/lib/google.ts`) und leert die Daten |
| Microsoft-365-Verbindung (Tenant-ID, Entwurfs-Postfach; keine Tokens) | DB `Integration` | bis der Kunde trennt bzw. Mandant gelöscht wird | Trennen leert die Konfiguration; Admin-Zustimmung widerruft der Kunde in seinem Entra ID |
| Termine im Google- bzw. Microsoft-Kalender des Kunden | außerhalb der Plattform | Sache des Kunden | – |
| Einsatzbericht (Befund, Arbeiten, Material, Zeiten), **Fotos** und **Kundenunterschrift** | DB `JobReport`, `JobPhoto` | mit dem Vorgang (Geschäftsdokumentation des Kunden) | kaskadierend mit dem Vorgang bzw. bei `eraseCustomer`; Fotos nur über angemeldete Abrufe bzw. den Geräte-Link des zuständigen Technikers **[PRÜFEN: eigene Frist für Fotos sinnvoll?]** |
| Geräte-Link der Techniker-App (nur SHA-256) | DB `EmployeeAppToken` | bis „neuer Link“/„Sperren“ oder Löschen des Mitarbeiters | – |
| **Ausgestellte Angebote, Rechnungen, Gutschriften an Endkunden** (eingefrorene Anschrift, Positionen, Beträge) | DB `Bill` | **Aufbewahrungspflicht des Kunden** (§ 147 AO, § 14b UStG: 8 bzw. 10 Jahre) **[PRÜFEN]** | werden nie gelöscht, nur storniert; bei Löschanfrage eines Endkunden wird der Kundendatensatz anonymisiert, die Belege bleiben (Art. 17 Abs. 3 lit. b DSGVO); Entwürfe werden gelöscht. Bei Vertragsende: Export an den Kunden vor der Mandantenlöschung |
| Zahlungseingänge aus hochgeladenen Kontoauszügen (Datum, Betrag, Name des Zahlers, Verwendungszweck) | DB `BankTransaction` | **90 Tage** | nur automatisch zugeordnete bzw. zur Prüfung vorgeschlagene Gutschriften werden gespeichert; Ausgaben und nicht zuordenbare Zahlungen werden beim Import verworfen; Löschjob `purgeBankTransactions` |
| Koordinaten zu Adressen (Einsatzplanung) | DB `GeoCache` (Schlüssel = SHA-256 der Adresse, Koordinaten auf ~10 m gerundet, keine Klartextadresse) | **180 Tage** | Löschjob `purgeGeoCache`; Fahrzeiten nur im Arbeitsspeicher (24 h) |
| Gebuchte Zusatzoptionen (Beginn, Ende, Preis) | DB `TenantAddon` | mit dem Mandanten | Abrechnungsgrundlage |
| Antwort auf „Passt es noch?“ (JA/NEIN, Zeitpunkt; Text in den Vorgangsnotizen) | DB `CallTicket.confirmation`, `notes` | mit dem Vorgang | – |
| Letzte Bewertungsanfrage | DB `Customer.reviewRequestedAt` | mit dem Endkunden | verhindert wiederholte Anfragen (90 Tage) |
| Rate-Limit-Zähler (gehashte Schlüssel) | DB `RateLimitHit` | 2 Tage | Löschjob (`purgeRateLimitHits`) |
| SMS beim Anbieter | Twilio | Twilio-Standard **[PRÜFEN: Löschung per API ergänzen]** | – |
| E-Mails im Postfach des Empfängers | außerhalb der Plattform | Sache des Empfängers | – |
| Sitzungen | DB `Session` | nach Ablauf (Admin 12 h, Kunde 90 Tage absolut) | Job löscht abgelaufene |
| Einladungs-/Reset-Token | DB `AuthToken` | 7 Tage nach Ablauf | Job |
| Audit-Log | DB `AuditLog` | **2 Jahre** | Job; Begründung: Nachweis von Zugriffen und Admin-Aktionen (Art. 5 Abs. 2, Art. 32) |
| Server-/Container-Logs | VPS (Docker) | Rotation 5 × 20 MB (App); keine Inhalte/Transkripte im Log | `docker-compose.yml` (logging), `src/lib/logger.ts` |
| Datenbank-Backups | VPS `./backups` und externer S3-Speicher (IONOS Object Storage) | lokal **14 Tage**, extern **30 Tage** rollierend | `deploy/backup.sh` (age-verschlüsselt); gelöschte Daten verschwinden spätestens nach **30 Tagen** auch aus den Backups. Bei aktiviertem Object Lock/Versionierung die Sperrfrist ≤ 30 Tage wählen **[PRÜFEN]** |
| Portal-Nutzer eines Kunden | DB `User` | Entfernen durch Kunden-Admin oder Vertragsende | Löschen im Portal (Sitzungen enden sofort) |
| **Gesamter Mandant** | alle Tabellen + Anbieter (Retell, Vapi, ElevenLabs, Twilio) | Vertragsende + max. 30 Tage (AVV § 10); **vorher Schlussabrechnung** (Abschnitt 5) | Plattform-Admin: Gesamtexport → „Mandant endgültig löschen“ (Re-Auth, Bestätigung per Slug): Anbieter-Löschung aller Anrufe, dann kaskadierendes Löschen aller Mandantendaten, Audit-Eintrag ohne Personenbezug |
| Vertrags-/Rechnungsdaten des Betreibers | außerhalb der Plattform (Buchhaltung) | 8 bzw. 10 Jahre (HGB/AO) **[PRÜFEN]** | Buchhaltung; Regel Abschnitt 5 |

## 2. Wiederherstellung aus Backup

Wird ein Backup eingespielt, können bereits gelöschte Daten zurückkehren. Deshalb: nach jeder Wiederherstellung sofort `POST /api/cron/retention` ausführen und Löschungen seit dem Zeitpunkt des Backups – bei einem Backup aus dem externen Speicher bis zu 30 Tage – (Audit-Log `customer.erase`, `tenant.delete`) erneut anwenden. **[PRÜFEN: Skript dafür]**

## 3. Löschung auf Anfrage eines Anrufers (Art. 17)

Der Anrufer wendet sich an den **Kunden** (Verantwortlicher). Der Kunde löscht im Portal unter Kunden → Datensatz → „Löschen“. Meldet sich der Anrufer beim Betreiber, leitet der Betreiber die Anfrage unverzüglich an den Kunden weiter (AVV § 6) und antwortet nicht selbst in der Sache.

## 4. Kontrolle

- Ergebnis jedes Laufs im Server-Log (`retention.done` mit Zählern, `providerFailed` > 0 beobachten).
- Plattform-Übersicht zeigt Mandanten und Konfiguration; vierteljährliche Stichprobe: ein alter Anruf je Mandant ist ohne Transkript und `providerPurgedAt` gesetzt.

## 5. Aufbewahrung ↔ Löschung (Abrechnung, GoBD) – Konflikt und Regelvorschlag (OP-16-13)

**Konflikt:** Der Betreiber muss Rechnungen und Buchungsbelege aufbewahren (nach Stand 2026 Rechnungen/Buchungsbelege 8 Jahre, Bücher und Jahresabschlüsse 10 Jahre, Handels- und Geschäftsbriefe 6 Jahre; § 147 AO, § 257 HGB, § 14b UStG **[PRÜFEN: aktuelle Fristen und ob die Plattform Teil der Buchführung ist]**). Gleichzeitig

1. löscht der Löschjob Anrufe ohne Kunden-/Vorgangsbezug schon nach `retentionDays` (mindestens 7 Tage) vollständig,
2. löscht `eraseCustomer` alle Anrufe eines Endkunden auf Weisung,
3. löscht „Mandant endgültig löschen“ alle Daten kaskadierend,

und die Abrechnung (`usageForMonth` in `src/lib/billing.ts`) **zählt die Minuten aus den Anrufdatensätzen**. Folge heute: Bei einer Löschfrist unter einem Monat, nach einer Endkunden-Löschung oder nach der Mandanten-Löschung fehlen Minuten in der Monatsabrechnung bzw. lässt sich eine Rechnung nicht mehr nachvollziehen. Umgekehrt dürfen Anruferdaten nicht 8 Jahre aufbewahrt werden, nur weil sie einmal abgerechnet wurden.

**Regelvorschlag:**

| # | Regel | Begründung |
|---|---|---|
| R1 | **Was aufbewahrt wird:** je Mandant und Monat nur zusammengefasste Abrechnungswerte – Anzahl Gespräche, abgerechnete Minuten, SMS-Anzahl, Paket, Preise, Rechnungsbetrag – **ohne** Rufnummern, Namen oder Inhalte. Dazu die Rechnung selbst. | Datenminimierung; ein Buchungsbeleg braucht keine Anruferdaten |
| R2 | **Monatsabschluss:** Bis zum 5. des Folgemonats werden die Werte aus R1 festgeschrieben (Rechnung bzw. Abrechnungsbeleg) und an die Buchhaltung übergeben. Aufbewahrung dort 8 Jahre (Rechnung/Beleg) bzw. 10 Jahre (Bücher). | Aufbewahrungspflicht liegt beim Betreiber als Verantwortlichem (Art. 6 Abs. 1 lit. c) |
| R3 | **Einzelaufstellung** (Zeitpunkt, Dauer, Status je Gespräch, Rufnummer höchstens gekürzt) nur als Nachweis bei Einwänden: Aufbewahrung bis 3 Monate nach Rechnungsdatum **[PRÜFEN: Frist]**, danach nur noch R1. | Einwände gegen die Rechnung prüfen können, ohne Anruferdaten langfristig zu halten |
| R4 | **Löschfrist der Kunden bleibt für Inhalte unverändert** (Transkript, Zusammenfassung, Aufnahme, Nachrichtentext nach `retentionDays`). Für die **abrechnungsrelevanten Metadaten** eines Anrufs (Zeit, Dauer, Status) gilt als Mindestfrist der Monatsabschluss: Vollständig gelöscht wird ein Anruf frühestens nach R2 des Monats, in dem er stattfand. | Verhindert fehlende Minuten; Inhalte werden nicht länger gespeichert |
| R5 | **Endkunden-Löschung** (`eraseCustomer`): Vor dem Löschen werden die Minuten des laufenden, noch nicht abgeschlossenen Monats in die Werte aus R1 übernommen; danach wird wie bisher vollständig gelöscht (auch beim Anbieter). | Betroffenenrecht geht vor; die Abrechnung braucht nur die Summe |
| R6 | **Mandanten-Löschung:** erst Schlussabrechnung (R2 für den letzten Monat), dann Gesamtexport an den Kunden, dann Löschung. Vertrags- und Rechnungsdaten des Kunden (Firma, Ansprechpartner, Rechnungen, R1-Werte) liegen in der Buchhaltung und werden nach Ablauf der Fristen dort gelöscht; die Plattform behält nach der Löschung nichts außer dem Audit-Eintrag ohne Personenbezug. | AVV § 10 Abs. 3 („Aufbewahrungspflichten des Betreibers bleiben unberührt; keine Inhaltsdaten“) |
| R7 | **Backups** enthalten Abrechnungsdaten nur für 30 Tage; die Aufbewahrung nach R2 erfolgt **nicht** über Backups, sondern in der Buchhaltung. | Backups sind kein Archiv |
| R8 | **Rechtsgrundlage und AVV:** Die Nutzung der Anruf-Metadaten für die eigene Abrechnung ist eine Verarbeitung des Betreibers als Verantwortlicher; sie ist in AVV § 2 als Ausnahme genannt und im VVT unter A3 geführt. | Transparenz gegenüber dem Kunden |

**Technische Umsetzung (2026-10-24):** Tabelle `BillingSnapshot` (ohne Fremdschlüssel, bleibt nach Kundenlöschung erhalten) mit Summen, Paket und Rechnungswerten je Kunde und Monat (R1). Der Löschfristen-Job schließt ab dem 3. des Folgemonats alle abgelaufenen Monate ab (R2) und löscht Anrufe erst, wenn ihr Monat festgeschrieben ist (R4); danach liefert die Abrechnung für diesen Monat die festgeschriebenen Werte. `eraseCustomer` anonymisiert Anrufe und Nachrichten (Nummer, Inhalte, Bezug weg; Dauer, Status, Kanal bleiben) statt sie zu löschen (R5). Vor dem Löschen eines Kunden wird die Schlussabrechnung des laufenden Monats festgeschrieben (R6, `partial`). Übergabe an die Buchhaltung: Verwaltung → Abrechnung → CSV liefert für abgeschlossene Monate die festgeschriebenen Werte (Spalte „Festgeschrieben“), auch für gelöschte Kunden. Rechnungen (Tabelle `Invoice`, ohne Fremdschlüssel) werden nie automatisch gelöscht – Aufbewahrung 10 Jahre (§ 147 AO) **[PRÜFEN]**, Löschung danach von Hand. Offen: Schnittstelle zum Rechnungsprogramm; die 8/10-Jahres-Aufbewahrung liegt dort, nicht in der Plattform **[PRÜFEN]**.
