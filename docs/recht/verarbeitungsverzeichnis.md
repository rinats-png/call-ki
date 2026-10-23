# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

> **Keine Rechtsberatung.** Teil A: Betreiber als **Verantwortlicher** (Art. 30 Abs. 1). Teil B: Betreiber als **Auftragsverarbeiter** (Art. 30 Abs. 2). Stand: 2026-10-23.

**Verantwortlicher / Auftragsverarbeiter:** `<Betreiber, Anschrift, Kontakt>`
**Datenschutzbeauftragter:** `<Name/Kontakt oder „nicht benannt – Pflicht geprüft am …“>` **[PRÜFEN: § 38 BDSG – Pflicht u. a. bei Verarbeitungen, die einer DSFA unterliegen]**

## Teil A – Eigene Verarbeitungen (Verantwortlicher)

### A1 Portal-Konten und Anmeldung
| Feld | Inhalt |
|---|---|
| Zweck | Zugang zum Kunden- und Admin-Portal, Absicherung (2FA), Missbrauchsschutz |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b (Vertrag mit dem Kunden; für Nutzer des Kunden: lit. f, berechtigtes Interesse an sicherer Bereitstellung) **[PRÜFEN]** |
| Betroffene | Plattform-Admins, Nutzer der Kunden |
| Daten | Name, E-Mail, Passwort-Hash, 2FA-Geheimnis (verschlüsselt), Wiederherstellungscodes (gehasht), Sitzungen (Token-Hash, Browser-Kennung/User-Agent, Zeitpunkte; keine IP-Adresse), Rolle |
| Empfänger | IONOS (Hosting), SMTP-Anbieter (Einladung, Reset) |
| Drittland | nein (abhängig vom SMTP-Anbieter) |
| Löschung | Sitzungen nach Ablauf; Konto bei Entfernung bzw. Vertragsende; Token 7 Tage nach Ablauf |
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
| Zweck | Vertragsschluss, Abrechnung nach Minuten/Tarif, Support |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b, c (Aufbewahrungspflichten) |
| Daten | Firma, Ansprechpartner, Kontaktdaten, Vertrags- und AVV-Stand, Nutzungsminuten, Rechnungen |
| Empfänger | Buchhaltung/Steuerberatung `<…>`, Zahlungsanbieter `<…>` |
| Löschung | Rechnungen 8 Jahre, Handelsbriefe 6 Jahre (Stand 2026 **[PRÜFEN]**) |

### A4 Website des Betreibers
| Feld | Inhalt |
|---|---|
| Zweck | Information, Kontaktaufnahme |
| Daten | Server-Logs (IP, Zeit, URL) über Caddy, Kontaktanfragen |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f; § 25 Abs. 2 TDDDG (technisch notwendige Cookies: nur Sitzungscookie im Portal, kein Tracking) |
| Löschung | Logs `<N>` Tage **[PRÜFEN]** |

## Teil B – Verarbeitungen im Auftrag (Art. 30 Abs. 2)

| Feld | Inhalt |
|---|---|
| Auftraggeber (Verantwortliche) | alle Mandanten der Plattform – Liste im Plattform-Admin (Name, Ansprechpartner, AVV-Version und -Datum) |
| Kategorien von Verarbeitungen | KI-Telefonannahme, Anliegen- und Terminverwaltung, Benachrichtigungen, optional Aufzeichnung (Details: AVV Anlage 1) |
| Unterauftragsverarbeiter | `unterauftragsverarbeiter.md` |
| Drittlandübermittlungen | USA (Twilio: BCR/SCC; Retell: SCC + TIA) |
| TOM | `toms.md` |
