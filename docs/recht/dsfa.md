# Datenschutz-Folgenabschätzung (Art. 35 DSGVO)

> **Keine Rechtsberatung.** Die DSFA ist Pflicht des **Verantwortlichen**, also des Kunden. Teil A ist die Risikoanalyse des Betreibers für die Plattform (Grundlage und Nachweis der TOM). Teil B ist eine Vorlage, die der Kunde übernehmen und ergänzen kann. Stand: 2026-10-23.

## Ist eine DSFA nötig? (Schwellwertanalyse)

| Kriterium | Zutreffend? | Begründung |
|---|---|---|
| DSK-Muss-Liste: Einsatz von KI zur Verarbeitung personenbezogener Daten, um die **Interaktion mit Betroffenen zu steuern** | **ja, wahrscheinlich** | Die KI führt das Gespräch, fragt nach und bucht Termine **[PRÜFEN: aktuelle Fassung der DSK-Liste und Liste der zuständigen Landesbehörde]** |
| Neue Technologien (EG 91, WP 248 Kriterium 8) | ja | Sprach-KI mit LLM |
| Mögliche sensible Daten (Art. 9) | möglich | Gesundheitsangaben von Anrufern (Stich, Allergie, Verletzung), nicht bezweckt |
| Drittlandtransfer | ja | Retell/Twilio USA |
| Umfangreiche Verarbeitung / systematische Überwachung | eher nein | ein Kunde, Anrufe auf eigene Nummer; keine Profilbildung |
| Automatisierte Entscheidung mit Rechtswirkung (Art. 22) | nein | KI entscheidet nur Terminvorschlag/Dringlichkeit; Mensch kann jederzeit übernehmen, Notfälle werden weitergeleitet |

**Ergebnis:** Für Kunden ist eine DSFA **voraussichtlich erforderlich** (zwei Kriterien der WP-248-Liste und Eintrag auf der Muss-Liste). Der Betreiber stellt Teil B als Vorlage bereit (AVV § 6 Abs. 3).

---

## Teil A – Risikoanalyse der Plattform (Betreiber)

### A.1 Beschreibung
Anruf auf Kundennummer (Twilio) → Weiterleitung per SIP an den KI-Agenten (Retell) → Agent erhält Kontext des Kunden über dynamische Variablen (Firmenangaben, ggf. Name/Adresse bekannter Anrufer) → ruft Funktionen der Plattform auf (Verfügbarkeit, Vorgang anlegen, Rückruf) → Plattform speichert Vorgang, versendet E-Mail/SMS, trägt Termin ein → nach Gesprächsende Transkript und Zusammenfassung in der Plattform. Datenflüsse und Daten: AVV Anlage 1.

### A.2 Notwendigkeit und Verhältnismäßigkeit
- **Zweckbindung:** nur Anliegenbearbeitung des jeweiligen Kunden; keine Nutzung für eigene Zwecke oder Training.
- **Datensparsamkeit:** Der Agent fragt nur ab, was die Branchenvorlage für ein Anliegen braucht; Aufzeichnung standardmäßig aus; Agent ohne Speicherung beim Anbieter, wenn nicht aufgezeichnet wird.
- **Speicherbegrenzung:** Löschfrist je Kunde, automatische Löschung auch bei den Anbietern (`loeschkonzept.md`).
- **Transparenz:** KI-Offenlegung und Datenschutzhinweis in der Begrüßung, ausführliche Information auf der Webseite des Kunden (`anrufer-information.md`).
- **Betroffenenrechte:** Export und Löschung je Endkunde im Portal; Wunsch nach Mensch → Rückrufvorgang bzw. Weiterleitung.

### A.3 Risiken und Maßnahmen

| # | Risiko | Eintritt | Schwere | Maßnahmen | Restrisiko |
|---|---|---|---|---|---|
| R1 | Daten eines Kunden für einen anderen sichtbar (Mandantenvermischung) | gering | hoch | `tenantId` aus Sitzung/Nummer, nie aus KI; Integrationstest; 404 bei Fremdzugriff | gering |
| R2 | KI gibt falsche Auskünfte oder erfindet Zusagen (Preise, Termine) | mittel | mittel | Prompt verbietet verbindliche Preiszusagen (`pricing_policy`); Termine nur über geprüfte Funktion mit Doppelbuchungsschutz; Bestätigung per E-Mail/SMS | mittel → Kunde informiert |
| R3 | Notfall wird nicht erkannt oder falsch priorisiert | gering | hoch | Schlüsselwort-Erkennung serverseitig zusätzlich zur KI; Weiterleitung an Notfalltechniker; Hinweis auf 112 bei Lebensgefahr; keine Disposition von Rettungsdiensten | gering–mittel |
| R4 | Unbefugter Zugriff auf Portal (Kontoübernahme) | mittel | hoch | 2FA (Pflicht für Admins), Rate-Limits, Leak-Prüfung, kurze Admin-Sitzungen, Re-Auth | gering |
| R5 | Zugriff von US-Behörden auf Daten bei Retell/Twilio | gering–mittel | mittel | SCC/BCR, TIA, Speicher-Minimierung, Löschung per API | mittel **[PRÜFEN]** |
| R6 | Sensible Angaben (Gesundheit) im Transkript | mittel | mittel | Löschfrist verkürzbar; Prompt fragt keine Gesundheitsdaten ab; Zugriff nur für Kundennutzer | mittel |
| R7 | Heimliche oder unzulässige Aufzeichnung | gering | hoch | Aufzeichnung aus per Standard; Agent ohne Speicherung; Hinweis wird erzwungen | gering (Rechtsfrage Einwilligung: `aufzeichnung.md`) |
| R8 | Anrufer weiß nicht, dass er mit KI spricht | gering | mittel | Offenlegung wird technisch erzwungen (Art. 50 KI-VO) | gering |
| R9 | Missbrauch: Kosten durch Massenanrufe, Spam | mittel | gering | Anrufe je Anrufer/Stunde, Minutenlimit je Mandant | gering |
| R10 | Datenverlust | gering | mittel | tägliche Backups, ☐ externe Kopie, ☐ Wiederherstellungstest | mittel bis umgesetzt |

### A.4 Ergebnis
Mit den Maßnahmen ist das Restrisiko aus Sicht des Betreibers **vertretbar**, sofern (1) die AVV/DPA mit allen Unterauftragsverarbeitern geschlossen, (2) die TIA für Retell dokumentiert und (3) die mit ☐ markierten TOM umgesetzt sind. Überprüfung: jährlich und bei wesentlichen Änderungen (neuer KI-Anbieter, neue Funktionen).

---

## Teil B – Vorlage für den Kunden

> Diesen Teil übernimmt der Kunde in seine eigene Dokumentation und ergänzt die `<Platzhalter>`.

1. **Verantwortlicher:** `<Firma>` · DSB: `<…>` · Datum: `<…>`
2. **Verarbeitung:** KI-Telefonassistenz für eingehende Anrufe auf `<Rufnummern>`, Zeiten: `<immer / außerhalb Öffnungszeiten / Überlauf>`.
3. **Zweck und Rechtsgrundlage:** Bearbeitung von Anfragen und Terminvereinbarung – Art. 6 Abs. 1 lit. b (vorvertraglich/vertraglich) und lit. f (berechtigtes Interesse an Erreichbarkeit) **[PRÜFEN]**; bei Aufzeichnung: Einwilligung (lit. a) **[PRÜFEN]**; Gesundheitsangaben: nicht bezweckt, Art. 9 Abs. 2 lit. a/f **[PRÜFEN]**.
4. **Einstellungen (vom Kunden gewählt):** Löschfrist `<…>` Tage · Aufzeichnung `<an/aus>` · Microsoft 365 verbunden `<ja/nein>` · SMS-Bestätigung `<ja/nein>` · Notfallweiterleitung `<ja/nein>`.
5. **Auftragsverarbeiter:** `<Betreiber>` (AVV vom `<…>`), Unterauftragnehmer laut Anlage 3.
6. **Risiken:** Teil A übernehmen, eigene ergänzen (z. B. Branchenbesonderheiten, besonders schutzbedürftige Anrufer).
7. **Eigene Maßnahmen des Kunden:** Datenschutzhinweis auf der Webseite veröffentlicht (`anrufer-information.md`), URL im Portal hinterlegt · Mitarbeiter im Umgang mit Transkripten geschult · Berechtigungen im Portal minimal vergeben · 2FA für Kunden-Admins aktiviert · Ablauf, wenn ein Anrufer keinen Kontakt mit KI möchte (Rückruf durch Mensch).
8. **Ergebnis / Freigabe:** `<vertretbar ja/nein, Datum, Unterschrift>`.
