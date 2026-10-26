# Unterauftragsverarbeiter und Drittlandtransfer

> **Keine Rechtsberatung.** Stand der Recherche: 2026-10-23. Zertifizierungen ändern sich – vor Vertragsschluss in der offiziellen DPF-Liste (dataprivacyframework.gov) und in den aktuellen Anbieterdokumenten prüfen und Datum hier eintragen.

## Liste für Anlage 3 (AVV)

| # | Anbieter | Leistung | Daten | Ort | Transfergrundlage | AVV/DPA abgeschlossen |
|---|---|---|---|---|---|---|
| 1 | **IONOS SE**, Montabaur | VPS-Hosting (App, Datenbank, lokale Backups 14 Tage) und Object Storage (S3-kompatibel) für die verschlüsselten externen Backups (30 Tage) | alle Plattformdaten (im Object Storage nur age-verschlüsselt) | Deutschland **[PRÜFEN: Rechenzentrum und Region des Buckets]** | – (EU) | ☐ `<Datum>` |
| 2 | **Twilio Inc.** (Vertragspartner für EU-Kunden ggf. Twilio Ireland Ltd. **[PRÜFEN]**) | Telefonnummern, Anrufannahme/-weiterleitung (SIP), SMS, optional Aufnahme | Rufnummern, Verbindungsdaten, Audio-Strom, SMS-Inhalt, ggf. Aufnahme | USA/global | Binding Corporate Rules (seit 2018) + DPA mit SCC **[PRÜFEN: zusätzlich DPF?]** | ☐ `<Datum>` |
| 3 | **Retell AI, Inc.**, Delaware, USA | KI-Sprachagent: Spracherkennung, Gesprächsführung (LLM), Sprachsynthese, Gesprächsprotokoll | Audio-Strom, Transkript, Zusammenfassung, dynamische Variablen (Name, Adresse bekannter Kunden), Funktionsaufrufe | USA (laut Retell kein Betrieb in der EU) | DPA mit SCC (Retell DPA, Stand 08.07.2026); **keine DPF-Zertifizierung gefunden** → Transfer Impact Assessment nötig **[PRÜFEN]** | ☐ `<Datum>` |
| 3a | Unterauftragnehmer von Retell (LLM-, STT-, TTS-Anbieter, Cloud) | wie 3 | wie 3 | USA **[PRÜFEN]** | über Retell-DPA | Liste bei Retell anfordern ☐ |
| 3b | **Vapi, Inc.**, USA (nur Kunden mit Sprach-KI „Vapi“) | KI-Sprachagent | wie 3 | USA; EU-Region nur mit Vapi Premier | DPA/SCC **[PRÜFEN]**; Zero Data Retention aktivierbar | ☐ `<Datum>` |
| 3c | **ElevenLabs** (Eleven Labs Inc. / ElevenLabs Sp. z o.o.) (nur Kunden mit „ElevenLabs“) | KI-Sprachagent, Sprachsynthese | wie 3 | USA/EU; EU-Datenresidenz vertraglich **[PRÜFEN]** | DPA/SCC **[PRÜFEN]**; Zero Retention Mode aktivierbar | ☐ `<Datum>` |
| 3d | Weitere Sprach-KI über SIP (Bland, Synthflow, PolyAI, …) | nur wenn für einen Kunden gewählt | wie 3 | je Anbieter | vor Aktivierung AVV/DPA abschließen und hier eintragen | ☐ |
| 5 | **HeiGIT gGmbH (OpenRouteService)**, Heidelberg – nur wenn unter Karten & Fahrzeiten gewählt (Alternative: eigene Nominatim/OSRM-Server, dann entfällt diese Zeile) | Geokodierung und Fahrzeiten für die Zusatzoption Einsatzplanung | Einsatzadressen (ohne Namen), Koordinaten | Deutschland **[PRÜFEN]** | – (EU) | ☐ `<Datum>` |
| 4 | **`<SMTP-Anbieter>`** (z. B. IONOS Mail, Brevo, Postmark) | Versand von Bestätigungen, Technikerinfos, Einladungen | E-Mail-Adresse, Name, Termin, Anliegen (Kurzfassung) | `<Ort>` | `<Grundlage>` | ☐ `<Datum>` |

**Nicht** in der Liste, weil kein Unterauftragsverarbeiter des Betreibers:
- **Google Kalender** – der Kunde verbindet sein eigenes Google-Konto; Google ist insoweit Auftragsverarbeiter des Kunden. Die Plattform speichert nur den (verschlüsselten) Refresh-Token.
- **Microsoft 365** – der Kunde verbindet seinen eigenen Tenant per Administratorzustimmung; Microsoft ist Auftragsverarbeiter des Kunden. Die Plattform ruft Graph mit App-Berechtigungen auf und speichert keine Microsoft-Tokens.
- **Have I Been Pwned** – erhält nur die ersten 5 Zeichen eines SHA-1-Hashes eines neuen Passworts (k-Anonymität), keinen Personenbezug.
- **GitHub** – enthält Quellcode, keine Produktionsdaten (Geheimnis-Scan in CI).

## Drittlandtransfer – Einschätzung

| Anbieter | Bewertung | Maßnahmen |
|---|---|---|
| Twilio | Konzernweite BCR von EU-Aufsichtsbehörden genehmigt; DPA mit SCC (2021er Fassung) | DPA im Twilio-Konto akzeptieren, Region prüfen (Twilio bietet für Teile der Plattform EU-Regionen an **[PRÜFEN]**), Aufnahme standardmäßig aus |
| Retell | Kern der Verarbeitung, USA, laut Recherche **nicht** DPF-zertifiziert (Aussage aus Community-Forum, nicht offiziell bestätigt) | SCC aus Retell-DPA, TIA dokumentieren; **Datensparsamkeit**: Agent mit Speicher-Einstellung „Basic Attributes Only“ für Mandanten ohne Aufzeichnung (`RETELL_AGENT_ID_NO_STORAGE`); Löschung je Anruf per API nach Löschfrist und bei Endkunden-Löschung; keine Trainingsnutzung (im DPA bestätigen lassen) **[PRÜFEN]** |

**Offene Fragen an Retell (schriftlich):**
1. Aktueller DPF-Status, aktuelle Unterauftragnehmerliste (welche LLM/STT/TTS?).
2. Kann Inferenz/Speicherung auf die EU beschränkt werden? Zeitplan?
3. Wird Audio/Transkript bei „Basic Attributes Only“ wirklich nicht gespeichert – auch nicht bei Unterauftragnehmern? Löschfristen der Logs?
4. Bestätigung: keine Nutzung von Kundendaten zum Modelltraining (auch nicht durch LLM-Anbieter, „zero data retention“?).

**Alternative bei negativem Ergebnis:** Die Plattform ist anbieterneutral aufgebaut (`provider`-Feld, Ereignis- und Tool-Schnittstelle in `src/lib/voice/`). Ein EU-gehosteter Sprach-KI-Anbieter kann als weiterer Provider ergänzt werden.

## Änderungsverlauf

| Datum | Änderung | Kunden informiert am |
|---|---|---|
| 2026-10-23 | Erstfassung | – |
| 2026-10-26 | OpenRouteService (optional) für Fahrzeiten ergänzt | `<Datum>` |
| 2026-10-24 | IONOS: Object Storage für Backups ergänzt (wird ein anderer S3-Anbieter genutzt, eigene Zeile anlegen) | `<Datum>` |
