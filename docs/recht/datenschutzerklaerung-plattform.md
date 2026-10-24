# Datenschutzerklärung – Portal und Website `<Plattformname>`

> **Keine Rechtsberatung – vor Veröffentlichung prüfen lassen [PRÜFEN].** Diese Erklärung betrifft nur die Verarbeitungen, für die der **Betreiber verantwortlich** ist (Portal-Konten, Website, Vertrag). Für Anrufer gilt die Datenschutzinformation des jeweiligen Unternehmens (Vorlage: `anrufer-information.md`). Nach Veröffentlichung die URL in `.env` als `LEGAL_PRIVACY_URL` eintragen – sie erscheint dann im Fuß des Portals und auf der Anmeldeseite.

---

## 1. Verantwortlicher
`<Betreiber, Anschrift, E-Mail, Telefon>` · Datenschutzbeauftragter: `<…>`

## 2. Überblick
Wir betreiben `<Plattformname>`, eine KI-Telefonassistenz für Unternehmen. Gespräche, die bei unseren Kunden eingehen, verarbeiten wir **im Auftrag** dieser Kunden (Art. 28 DSGVO); verantwortlich dafür ist das jeweilige Unternehmen. Diese Erklärung beschreibt, was wir **selbst** verarbeiten.

## 3. Aufruf der Website und des Portals
Beim Aufruf verarbeitet unser Webserver technisch notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browserkennung), um die Seite auszuliefern und Angriffe abzuwehren. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Speicherdauer: `<N>` Tage **[PRÜFEN]**. Hosting: IONOS SE, Rechenzentrum in Deutschland (Auftragsverarbeiter). Zum Schutz vor Missbrauch zählen wir Anmelde- und ähnliche Versuche je IP-Adresse bzw. E-Mail-Adresse; gespeichert wird nur ein Hashwert mit Zeitfenster, gelöscht nach 2 Tagen.

Wir verwenden **keine** Analyse- oder Werbe-Tools und laden keine Schriften oder Skripte von Drittservern.

## 4. Cookies
Im Portal setzen wir nur ein technisch notwendiges Sitzungscookie (`ck_session`, HttpOnly) für die Anmeldung, sowie eine Einstellung für das Farbschema im lokalen Speicher Ihres Browsers. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b/f DSGVO. Eine Einwilligung ist dafür nicht erforderlich.

## 5. Portal-Konto
**Daten:** Name, E-Mail-Adresse, Passwort (nur als Hash), 2FA-Einrichtung (verschlüsselt), Sitzungen (Zeitpunkte, Browserkennung), Protokoll sicherheitsrelevanter Aktionen.
**Zweck:** Bereitstellung des Portals, Schutz vor Missbrauch, Nachweis von Zugriffen.
**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag mit Ihrem Unternehmen) bzw. lit. f (sichere Bereitstellung für Nutzer, die das Unternehmen einlädt).
**Passwortprüfung:** Bei neuen Passwörtern prüfen wir anonym gegen bekannte Datenlecks (Have I Been Pwned). Übermittelt werden nur die ersten fünf Zeichen eines Hashwerts – nicht Ihr Passwort und keine E-Mail-Adresse.
**E-Mails:** Einladungen und Passwort-Links versenden wir über `<SMTP-Anbieter>`.
**Speicherdauer:** bis zur Entfernung des Kontos; Sitzungen bis Ablauf; Sicherheitsprotokoll 2 Jahre.

**Kalender-Verbindungen:** Verbindet Ihr Unternehmen einen Google- oder Microsoft-365-Kalender, erfolgt die Anmeldung direkt bei Google bzw. Microsoft. Wir speichern bei Google nur einen verschlüsselten Zugriffsschlüssel (Refresh-Token) und die E-Mail-Adresse des verbindenden Kontos, bei Microsoft nur die Kennung Ihres Microsoft-Tenants und ggf. das Postfach für Antwortentwürfe. Die Verbindung kann jederzeit im Portal getrennt werden; dabei widerrufen wir den Google-Zugriff. Für die Kalenderdaten selbst gilt der Vertrag Ihres Unternehmens mit Google bzw. Microsoft.

## 6. Vertrag und Abrechnung
Daten der Ansprechpartner unserer Kunden verarbeiten wir zur Vertragsdurchführung (Art. 6 Abs. 1 lit. b) und zur Erfüllung von Aufbewahrungspflichten (lit. c; Rechnungen 8 Jahre **[PRÜFEN]**). Grundlage der Abrechnung sind Anzahl und Dauer der Gespräche laut unserem Telefonie-Dienstleister Twilio sowie die Anzahl versendeter SMS. Erreicht ein Unternehmen 80 % bzw. 100 % seines Minutenkontingents, informieren wir die Administratoren per E-Mail (Art. 6 Abs. 1 lit. b). Für die Abrechnung bewahren wir je Monat nur zusammengefasste Verbrauchswerte ohne Anruferdaten auf.

## 6a. Betrieb, Überwachung und Datensicherung
Um Ausfälle zu erkennen, prüft die Plattform automatisch ihren Zustand und benachrichtigt unsere Administratoren per E-Mail, SMS (über Twilio) und ggf. einen Benachrichtigungsdienst `<Dienst>` **[PRÜFEN]**; die Meldungen enthalten Firmennamen unserer Kunden und technische Fehlertexte, keine Gesprächsinhalte. Ein externer Überwachungsdienst `<Dienst, Sitz>` **[PRÜFEN]** erhält nur ein Lebenszeichen der Plattform. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer Betrieb). Alle Daten werden täglich verschlüsselt gesichert, auf dem Server 14 Tage und in einem Speicher bei IONOS (S3-kompatibler Object Storage, Deutschland **[PRÜFEN]**) 30 Tage.

## 7. Empfänger und Drittländer
IONOS SE (Hosting und Datensicherung, Deutschland), `<SMTP-Anbieter>`, Twilio (SMS-Benachrichtigungen an unsere Administratoren), `<Überwachungs-/Benachrichtigungsdienst>` **[PRÜFEN]**. Für die Telefonie-Funktionen (Auftragsverarbeitung) setzen wir Twilio sowie – je nach Wahl des Unternehmens – Retell AI, Vapi oder ElevenLabs als Sprach-KI ein (überwiegend USA; Garantien nach Art. 44 ff. DSGVO siehe Unterauftragsverarbeiter-Liste) – siehe die Datenschutzinformation des jeweiligen Unternehmens. Google und Microsoft erhalten Daten nur, wenn Ihr Unternehmen seinen eigenen Kalender verbindet (Abschnitt 5).

## 8. Ihre Rechte
Auskunft (Art. 15), Berichtigung (16), Löschung (17), Einschränkung (18), Datenübertragbarkeit (20), Widerspruch (21), Beschwerde bei einer Aufsichtsbehörde (Art. 77), z. B. `<zuständige Behörde>`. Kontakt: `<E-Mail>`.

## 9. Pflicht zur Bereitstellung, automatisierte Entscheidungen
Ohne E-Mail-Adresse und Passwort ist kein Portal-Zugang möglich. Automatisierte Entscheidungen nach Art. 22 DSGVO finden nicht statt.

Stand: `<Datum>`
