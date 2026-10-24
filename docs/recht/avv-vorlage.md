# Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO) – Vorlage

> **Keine Rechtsberatung – vor Verwendung durch eine Fachperson prüfen lassen [PRÜFEN].** Struktur angelehnt an Art. 28 Abs. 3 DSGVO und die Standardvertragsklauseln der EU-Kommission für Auftragsverarbeitung (Durchführungsbeschluss (EU) 2021/915). Versionsnummer und Abschlussdatum werden im Plattform-Admin beim Mandanten eingetragen (Feld „AVV“); ohne diese Angaben lässt sich der Mandant nicht auf „Aktiv“ setzen.

**AVV-Version:** `2026-10` · **Gehört zu:** Hauptvertrag/AGB vom `<Datum>`

## Parteien

**Verantwortlicher (Auftraggeber):** `<Firma, Anschrift, Vertretung>` – im Folgenden „Kunde“
**Auftragsverarbeiter (Auftragnehmer):** `<Betreiber, Anschrift, Vertretung>` – im Folgenden „Betreiber“

## § 1 Gegenstand und Dauer

1. Der Betreiber stellt dem Kunden eine KI-Telefonassistenz als Software-as-a-Service bereit (eingehende Anrufe annehmen, Anliegen aufnehmen, Termine vorschlagen, eintragen, verschieben und absagen, Benachrichtigungen und Terminerinnerungen versenden, Kundenportal). Einzelheiten: **Anlage 1**.
2. Die Laufzeit entspricht der Laufzeit des Hauptvertrags. § 10 (Vertragsende) gilt darüber hinaus.

## § 2 Art, Zweck, Daten, Betroffene

Siehe **Anlage 1**. Eine Verarbeitung zu eigenen Zwecken des Betreibers findet nicht statt. Ausgenommen sind (a) die Verarbeitung von Anruf-Metadaten (Zeitpunkt, Dauer laut Statusmeldung des Telefonie-Dienstleisters, Status) zur Abrechnung und Durchsetzung des vereinbarten Kontingents sowie (b) aggregierte Nutzungszahlen (z. B. Gesprächsminuten und SMS je Mandant und Monat) für Abrechnung, Kostenschutz, Betriebsüberwachung und Kapazitätsplanung; hierfür ist der Betreiber selbst verantwortlich, langfristig aufbewahrt werden nur Monatswerte ohne Anruferdaten (Löschkonzept Abschnitt 5) **[PRÜFEN]**. Eine Nutzung von Inhaltsdaten zum Training von KI-Modellen durch den Betreiber erfolgt **nicht**.

## § 3 Weisungen

1. Der Betreiber verarbeitet Daten nur auf dokumentierte Weisung des Kunden. Weisungen sind dieser Vertrag, die Konfiguration im Kundenportal (z. B. Löschfrist, Aufzeichnung an/aus, Benachrichtigungen) sowie Weisungen in Textform an `<Kontakt Betreiber>`.
2. Hält der Betreiber eine Weisung für rechtswidrig, informiert er den Kunden unverzüglich und darf die Ausführung bis zur Bestätigung aussetzen.
3. Ist der Betreiber durch Unionsrecht oder das Recht eines Mitgliedstaats zu einer Verarbeitung verpflichtet, teilt er dies vorher mit, sofern das Recht es nicht verbietet.

## § 4 Vertraulichkeit

Der Betreiber setzt nur Personen ein, die zur Vertraulichkeit verpflichtet sind. Zugriff auf Inhalte eines Mandanten durch den Betreiber nur, soweit für Support, Fehlerbehebung oder Sicherheit erforderlich; jeder Zugriff über den Mandantenwechsel wird im Audit-Log protokolliert und ist für den Kunden einsehbar (Einstellungen → Aktivität).

## § 5 Sicherheit der Verarbeitung

Der Betreiber trifft die Maßnahmen nach **Anlage 2** (TOM). Er darf sie weiterentwickeln, solange das Schutzniveau nicht unterschritten wird; wesentliche Änderungen werden dokumentiert und mitgeteilt.

## § 6 Unterstützung des Kunden

1. **Betroffenenrechte:** Das Portal ermöglicht dem Kunden selbst Auskunft/Export je Endkunde (JSON), Berichtigung und Löschung inkl. Löschung bei den Telefonie-/KI-Anbietern (Twilio sowie je nach Wahl Retell, Vapi oder ElevenLabs). Darüber hinaus unterstützt der Betreiber auf Anfrage **[PRÜFEN: Vergütung]**.
2. **Datenpannen:** Der Betreiber meldet Verletzungen des Schutzes personenbezogener Daten **unverzüglich, spätestens innerhalb von 24 Stunden** nach Bekanntwerden **[PRÜFEN: Frist]** mit den Angaben nach Art. 33 Abs. 3 DSGVO, soweit verfügbar (Ablauf: `incident-plan.md`).
3. **DSFA und Konsultation:** Der Betreiber stellt die Informationen bereit, die der Kunde für eine Datenschutz-Folgenabschätzung braucht (Vorlage: `dsfa.md` Teil B).

## § 7 Unterauftragsverarbeiter

1. Der Kunde genehmigt die in **Anlage 3** genannten Unterauftragsverarbeiter (allgemeine schriftliche Genehmigung, Art. 28 Abs. 2 DSGVO).
2. Der Betreiber informiert über beabsichtigte Änderungen mindestens **30 Tage** vorher in Textform. Der Kunde kann aus wichtigem datenschutzrechtlichem Grund innerhalb von 14 Tagen widersprechen; ist keine Einigung möglich, besteht ein Sonderkündigungsrecht **[PRÜFEN]**.
3. Der Betreiber verpflichtet jeden Unterauftragsverarbeiter vertraglich auf gleichwertige Pflichten.
4. **Nicht** Unterauftragsverarbeiter des Betreibers sind Microsoft (Microsoft 365) und Google (Google Kalender), wenn der Kunde sein eigenes Konto bzw. seinen eigenen Tenant verbindet; dafür gilt der Vertrag zwischen Kunde und Microsoft bzw. Google. Der Betreiber speichert dafür nur den verschlüsselten Google-Refresh-Token bzw. die Microsoft-Tenant-ID und liest/schreibt Kalenderdaten nur, soweit es für die Terminfunktionen nötig ist.

## § 8 Übermittlung in Drittländer

Übermittlungen in Länder außerhalb des EWR erfolgen nur unter den Voraussetzungen der Art. 44 ff. DSGVO (Angemessenheitsbeschluss inkl. EU-US Data Privacy Framework, Standardvertragsklauseln, verbindliche interne Datenschutzvorschriften). Die jeweilige Grundlage steht in Anlage 3.

## § 9 Nachweise und Kontrollen

Der Betreiber weist die Einhaltung durch diese Dokumentation, Zertifikate seiner Unterauftragsverarbeiter und Auskünfte nach. Vor-Ort-Kontrollen nach Anmeldung mit angemessener Frist (mindestens 14 Tage), zu üblichen Geschäftszeiten, höchstens einmal jährlich ohne Anlass **[PRÜFEN: Kostenregel]**.

## § 10 Vertragsende: Rückgabe und Löschung

1. Der Kunde kann bis zum Vertragsende jederzeit einen **Gesamtexport** (alle Endkunden, Vorgänge, Anrufe, Nachrichten, Einstellungen; JSON) abrufen; nach Vertragsende stellt der Betreiber den Export auf Anforderung innerhalb von 30 Tagen bereit.
2. Spätestens **30 Tage** nach Vertragsende löscht der Betreiber alle Daten des Kunden, einschließlich der Löschung bei Twilio und dem genutzten Sprach-KI-Anbieter (Retell, Vapi bzw. ElevenLabs); eine Google-Kalender-Verbindung wird dabei widerrufen. Verschlüsselte Datenbank-Backups laufen danach automatisch aus (lokal **14 Tage**, externer Backup-Speicher **30 Tage**). Die Löschung wird auf Anfrage in Textform bestätigt.
3. Gesetzliche Aufbewahrungspflichten des Betreibers (z. B. Rechnungen) bleiben unberührt; diese betreffen keine Inhaltsdaten und keine Anruferdaten, sondern nur Vertrags- und Rechnungsdaten sowie Monatswerte des Verbrauchs (Löschkonzept Abschnitt 5).

## § 11 Haftung, Schlussbestimmungen

Haftung nach Art. 82 DSGVO; im Übrigen gilt der Hauptvertrag **[PRÜFEN]**. Bei Widersprüchen geht dieser Vertrag in Datenschutzfragen dem Hauptvertrag vor. Textform genügt.

`<Ort, Datum, Unterschriften>`

---

## Anlage 1 – Gegenstand der Verarbeitung

| Punkt | Inhalt |
|---|---|
| **Art der Verarbeitung** | Annahme und Weiterleitung von Telefonanrufen; Spracherkennung, Sprachsynthese und Gesprächsführung durch ein KI-System; Erstellen von Vorgängen, Zusammenfassungen und Transkripten; Terminvorschläge, -buchung, -verschiebung und -absage (interner Kalender, Google Kalender oder Microsoft 365 des Kunden); Versand von E-Mails/SMS (Bestätigungen, Technikerinformationen, Notfall-Alarme, Terminerinnerungen, Kontingent-Warnungen an Portal-Nutzer); Erfassung von Gesprächsende, -dauer und -status über die Statusmeldung des Telefonie-Dienstleisters; tägliche verschlüsselte Datensicherung; Speicherung, Anzeige, Export, Löschung im Portal; optional Gesprächsaufzeichnung |
| **Zweck** | Erreichbarkeit des Kunden, Aufnahme und Bearbeitung von Kundenanliegen, Terminvergabe, Notfallweiterleitung |
| **Datenkategorien** | Telefonnummer des Anrufers und angerufene Nummer, Zeitpunkt und Dauer; Name, Firma, Anschrift, PLZ, E-Mail; Inhalt des Anliegens (Transkript, Zusammenfassung, Kategorie, Dringlichkeit); optional Audioaufnahme (Stimme); Termine; Nachrichteninhalte; Einwilligung/Widerspruch zu SMS und ggf. zur Aufzeichnung (Zeitpunkt, Quelle); Gesprächsdauer und -status laut Telefonie-Dienstleister; Mitarbeiterdaten des Kunden (Name, Rolle, E-Mail, Telefonnummer, Einsatz-PLZ); Portal-Nutzer des Kunden (Name, E-Mail, Protokolldaten) |
| **Besondere Kategorien (Art. 9)** | Nicht bezweckt. Anrufer können jedoch von sich aus z. B. Gesundheitsangaben machen (Allergie, Stich, Verletzung); diese können im Transkript landen. Der Kunde sollte eine kurze Löschfrist wählen **[PRÜFEN]** |
| **Betroffene** | Anrufer (Interessenten, Kunden, Hausverwaltungen, Dritte), Mitarbeiter des Kunden, Portal-Nutzer des Kunden |
| **Ort** | Server und Backup-Speicher in Deutschland (IONOS, VPS und Object Storage **[PRÜFEN: Region]**); Telefonie und KI-Verarbeitung (Twilio; Retell, Vapi oder ElevenLabs je nach Wahl des Kunden) teils in den USA (Anlage 3) |

## Anlage 2 – Technische und organisatorische Maßnahmen

→ [toms.md](toms.md) in der jeweils beim Vertragsschluss gültigen Fassung (als PDF beifügen).

## Anlage 3 – Genehmigte Unterauftragsverarbeiter

→ [unterauftragsverarbeiter.md](unterauftragsverarbeiter.md), Abschnitt „Liste für Anlage 3“.
