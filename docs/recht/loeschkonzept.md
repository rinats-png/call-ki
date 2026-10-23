# Löschkonzept

> **Keine Rechtsberatung.** Beschreibt, wann welche Daten gelöscht werden und **wie das technisch passiert** (Belege im Code). Die Löschfrist für Gesprächsinhalte legt der Kunde als Verantwortlicher fest (Einstellungen → Datenschutz, 7–3650 Tage, Standard 365). Stand: 2026-10-23.

## 1. Fristen

| Datenart | Wo | Frist / Auslöser | Umsetzung |
|---|---|---|---|
| Transkript, Zusammenfassung, Aufnahme-Link eines Anrufs | DB `Call` | `retentionDays` des Mandanten nach Anrufbeginn | täglicher Job `runRetention` setzt Felder auf leer |
| Aufnahme, Transkript, Anrufprotokoll **beim Anbieter** | Retell, Twilio | wie oben (vorher) | `purgeCallAtProviders`: Retell `DELETE /v2/delete-call/{id}`, Twilio Recording + Call löschen; Erfolg in `providerPurgedAt`; Fehlschläge werden am Folgetag wiederholt (max. 200 je Mandant und Lauf) |
| Anruf-Datensatz ohne Kundenbezug und ohne Vorgang (z. B. aufgelegt) | DB `Call` | `retentionDays`, nachdem beim Anbieter gelöscht | Job löscht den Datensatz vollständig |
| Anruf-Metadaten mit Kunden-/Vorgangsbezug (Nummer, Zeit, Dauer) | DB `Call` | bis der Kunde den Endkunden löscht | Geschäftsdokumentation des Kunden **[PRÜFEN: eigene Frist sinnvoll?]** |
| Transkript im Vorgang | DB `CallTicket.transcript` | `retentionDays` | Job leert Feld |
| Vorgang (Kategorie, Termin, Zusammenfassung, Notizen) | DB `CallTicket` | bis der Kunde Endkunde/Vorgang löscht | Geschäftsdokumentation; Handels-/Steuerfristen liegen beim Kunden |
| Endkunde (Name, Nummer, Adresse) | DB `Customer` | auf Weisung (Löschung im Portal) oder Vertragsende | `eraseCustomer`: löscht Kunde, Vorgänge, Anrufe, Nachrichten – **zuerst bei Retell/Twilio**; meldet, falls die Anbieter-Löschung unvollständig war |
| Nachrichteninhalt (E-Mail/SMS-Text) | DB `Message.body` | `retentionDays` | Job leert Inhalt; Empfänger, Zweck, Status bleiben als Versandnachweis |
| SMS beim Anbieter | Twilio | Twilio-Standard **[PRÜFEN: Löschung per API ergänzen]** | – |
| E-Mails im Postfach des Empfängers / Kalender im Microsoft 365 des Kunden | außerhalb der Plattform | Sache des Empfängers bzw. Kunden | – |
| Sitzungen | DB `Session` | nach Ablauf (Admin 12 h, Kunde 90 Tage absolut) | Job löscht abgelaufene |
| Einladungs-/Reset-Token | DB `AuthToken` | 7 Tage nach Ablauf | Job |
| Audit-Log | DB `AuditLog` | **2 Jahre** | Job; Begründung: Nachweis von Zugriffen und Admin-Aktionen (Art. 5 Abs. 2, Art. 32) |
| Server-/Container-Logs | VPS (Docker) | Rotation 5 × 20 MB (App); keine Inhalte/Transkripte im Log | `docker-compose.yml` (logging), `src/lib/logger.ts` |
| Datenbank-Backups | VPS `./backups` (+ extern) | **14 Tage** rollierend | `deploy/backup.sh`; gelöschte Daten verschwinden spätestens nach 14 Tagen auch aus Backups |
| Portal-Nutzer eines Kunden | DB `User` | Entfernen durch Kunden-Admin oder Vertragsende | Löschen im Portal (Sitzungen enden sofort) |
| **Gesamter Mandant** | alle Tabellen + Anbieter | Vertragsende + max. 30 Tage (AVV § 10) | Plattform-Admin: Gesamtexport → „Mandant endgültig löschen“ (Re-Auth, Bestätigung per Slug): Anbieter-Löschung aller Anrufe, dann kaskadierendes Löschen aller Mandantendaten, Audit-Eintrag ohne Personenbezug |
| Vertrags-/Rechnungsdaten des Betreibers | außerhalb der Plattform | 8 bzw. 10 Jahre (HGB/AO) **[PRÜFEN]** | Buchhaltung |

## 2. Wiederherstellung aus Backup

Wird ein Backup eingespielt, können bereits gelöschte Daten zurückkehren. Deshalb: nach jeder Wiederherstellung sofort `POST /api/cron/retention` ausführen und Löschungen der letzten 14 Tage (Audit-Log `customer.erase`, `tenant.delete`) erneut anwenden. **[PRÜFEN: Skript dafür]**

## 3. Löschung auf Anfrage eines Anrufers (Art. 17)

Der Anrufer wendet sich an den **Kunden** (Verantwortlicher). Der Kunde löscht im Portal unter Kunden → Datensatz → „Löschen“. Meldet sich der Anrufer beim Betreiber, leitet der Betreiber die Anfrage unverzüglich an den Kunden weiter (AVV § 6) und antwortet nicht selbst in der Sache.

## 4. Kontrolle

- Ergebnis jedes Laufs im Server-Log (`retention.done` mit Zählern, `providerFailed` > 0 beobachten).
- Plattform-Übersicht zeigt Mandanten und Konfiguration; vierteljährliche Stichprobe: ein alter Anruf je Mandant ist ohne Transkript und `providerPurgedAt` gesetzt.
