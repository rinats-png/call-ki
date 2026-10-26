# Abweichungen vom Plan

> Wird vom Coding-Tool während der Umsetzung gepflegt (siehe `AGENTS.md` Abschnitt 7). Jede Abweichung mit Datum, Art und betroffenen IDs. Wesentliche Abweichungen nur mit Zustimmung des Projektinhabers.
> Angelegt 2026-10-24 mit dem Übergabepaket; Code-Stand `5279652`. Abweichungen, die vor der Übergabe entstanden sind, stehen in den Phasen-Dokumenten unter `docs/idea-to-app/` (Nachträge mit Commit) und in `B2-soll-und-luecken.md`.

| Nr | Datum | Art (klein / wesentlich) | Was wurde anders gemacht? | Warum | Betroffene IDs | Zugestimmt von / am | Angepasste Dokumente |
|---|---|---|---|---|---|---|---|
| A-01 | 2026-10-26 | wesentlich | Leistungskatalog mit Dauer, Gewerk, Preis; Zuständigkeit nach Gewerk | Ausbauplan Phase 1 (Demo-Videos) | P1-1 | Projektinhaber, 2026-10-26 („alles aufbauen“) | `docs/recht/verarbeitungsverzeichnis.md` |
| A-02 | 2026-10-26 | wesentlich | Angebote, Rechnungen, Gutschriften an Endkunden mit GiroCode (Vorbild Veyra); ausgestellte Belege unveränderlich, Storno per Gutschrift; Löschanfrage anonymisiert statt löscht, wenn Belege existieren | Aufbewahrungspflicht (§ 147 AO) geht der Löschung vor | P1-4 | Projektinhaber, 2026-10-26 | `docs/recht/loeschkonzept.md` |
| A-03 | 2026-10-26 | wesentlich | Techniker-App als PWA über persönlichen Geräte-Link (kein Login), Einsatzbericht mit Fotos und Unterschrift, Rechnungsentwurf beim Abschluss | Techniker haben keine Portal-Konten; Link ist sperr- und erneuerbar | P1-2, P1-3 | Projektinhaber, 2026-10-26 | `docs/recht/loeschkonzept.md` |
| A-04 | 2026-10-26 | klein | „Passt es noch?“ per SMS (Webhook `/api/twilio/sms`), Unterwegs-Nachricht, Bitte um Bewertung | Weniger Leerfahrten, mehr Bewertungen | P1-5 | Projektinhaber, 2026-10-26 | README, `docs/betrieb.md` |
| A-05 | 2026-10-26 | wesentlich | Rechnungen, Techniker-App und Kundenkontakt sind einzeln buchbare Zusatzoptionen; die Oberfläche zeigt nur Gebuchtes | Einfache Oberfläche für Kunden, die nur den Telefonassistenten nutzen | P1-1 bis P1-5 | Projektinhaber, 2026-10-26 | `docs/recht/loeschkonzept.md` |
| A-06 | 2026-10-26 | klein | Zahlungsabgleich per Kontoauszug-Upload (CAMT/CSV) statt Bankzugriff; Live-Anbindung über lizenzierten Kontoinformationsdienst (z. B. finAPI) offen | Kein Bankzugriff nötig, keine Vertragskosten | P1-4 | Projektinhaber, 2026-10-26 | `docs/recht/loeschkonzept.md` |
