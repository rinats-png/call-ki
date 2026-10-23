# Eckpunkte für AGB, Leistungsbeschreibung und SLA

> **Keine Rechtsberatung.** Stichpunkte als Briefing für die Fachperson, die die AGB schreibt **[PRÜFEN]**. Angebot ausschließlich an **Unternehmer** (§ 14 BGB).

## Leistung
- SaaS: KI-Telefonassistenz, Kundenportal, Rufnummer(n) über den Betreiber oder Weiterleitung einer Kundennummer.
- Tarife nach Plan und **Minutenkontingent** (`plan`, `monthlyMinuteLimit`); Verhalten bei Überschreitung: Anrufe gehen an das Ersatzziel (Weiterleitung/Mailbox) – festlegen, ob Mehrminuten berechnet werden.
- Optionale Leistungen: Microsoft-365-Anbindung, SMS (Kosten je SMS), Einrichtung/Onboarding.

## Pflichten des Kunden
- Richtige Konfiguration (Öffnungszeiten, Notfallnummern, Mitarbeiter, PLZ-Gebiete) und deren Pflege.
- Eigene Datenschutzinformation für Anrufer veröffentlichen, URL im Portal hinterlegen; ggf. DSFA durchführen.
- Gesprächsaufzeichnung nur nach eigener rechtlicher Prüfung aktivieren.
- 2FA für Admins aktivieren; Zugangsdaten geheim halten.
- Keine rechtswidrigen Inhalte in Begrüßung/FAQ; keine Nutzung für Werbeanrufe (ausgehend ist ohnehin nicht vorgesehen).

## Ausschlüsse (wichtig für KI-VO und Haftung)
- **Kein Notrufdienst.** Nicht zulässig für Notrufannahme, Rettungsdienst, Feuerwehr, Polizei, ärztlichen Bereitschaftsdienst, Krankentransport oder Triage im Gesundheitswesen (sonst ggf. Hochrisiko-KI, Anhang III Nr. 5 lit. d).
- Keine Verwendung für rechtsverbindliche Erklärungen durch die KI (Vertragsschluss, Preiszusagen) – KI nimmt Anliegen auf und schlägt Termine vor.
- Keine Nutzung für besondere Kategorien von Daten als Hauptzweck (z. B. Arztpraxis-Anamnese) ohne gesonderte Vereinbarung.

## KI-spezifisch
- Hinweis: KI-Antworten können fehlerhaft sein; der Kunde prüft Vorgänge.
- Offenlegung als KI ist nicht abschaltbar (Art. 50 KI-VO).
- Kein Training mit Kundendaten durch den Betreiber.

## Verfügbarkeit (SLA-Vorschlag)
- Zielverfügbarkeit Portal und Anrufannahme `<99,5 %>` im Monatsmittel, ohne angekündigte Wartung und Störungen bei Unterauftragnehmern (Twilio, Retell) **[PRÜFEN: Abhängigkeiten offenlegen]**.
- Ausfallsicherung: bei Störung der KI leitet Twilio auf das vom Kunden hinterlegte Ersatzziel.
- Support: E-Mail `<…>`, Reaktionszeit `<…>`; Störungskommunikation über `<Statusseite/E-Mail>`.

## Laufzeit und Ende
- Laufzeit `<monatlich / 12 Monate>`, Kündigungsfrist `<…>`.
- Rufnummern-Portierung bei Vertragsende **[PRÜFEN]**.
- Gesamtexport bis Vertragsende, Löschung spätestens 30 Tage danach (AVV § 10).

## Haftung
- Begrenzung auf typische, vorhersehbare Schäden; Ausnahmen für Vorsatz, grobe Fahrlässigkeit, Leben/Körper/Gesundheit, Kardinalpflichten **[PRÜFEN]**.
- Ausdrücklich: keine Haftung für entgangene Aufträge durch Fehlinterpretation der KI im Rahmen der Begrenzung **[PRÜFEN]**.

## Sonstiges
- AVV als Anlage (verpflichtend vor Aktivierung – im Produkt technisch erzwungen).
- Änderung der Unterauftragsverarbeiter mit 30 Tagen Vorlauf.
- Gerichtsstand, anwendbares Recht.
