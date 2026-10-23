# Recht & Datenschutz – Übersicht

> **Keine Rechtsberatung.** Diese Unterlagen sind eine strukturierte Arbeitsgrundlage, abgeleitet aus dem tatsächlichen Code-Stand (Stand: 2026-10-23). Alle mit **[PRÜFEN]** markierten Stellen müssen vor dem ersten zahlenden Kunden von einer Fachperson (Datenschutz/IT-Recht) geprüft werden. Platzhalter stehen in `<spitzen Klammern>`.

## Rollenmodell (Grundlage aller Dokumente)

| Wer | Rolle nach DSGVO | Für welche Daten |
|---|---|---|
| **Kunde (Mandant)**, z. B. ein Schädlingsbekämpfer | **Verantwortlicher** (Art. 4 Nr. 7) | Anrufer, Endkunden, Termine, Transkripte, Aufnahmen, eigene Mitarbeiter im Portal |
| **Plattformbetreiber** `<Betreiber>` | **Auftragsverarbeiter** (Art. 28) des Kunden | alles oben, soweit über die Plattform verarbeitet |
| **Plattformbetreiber** `<Betreiber>` | **Verantwortlicher** | eigene Vertragsdaten, Portal-Konten (Login, 2FA, Audit), Abrechnung, Website |
| IONOS, Twilio, Retell AI (+ deren LLM-/Sprach-Anbieter), SMTP-Anbieter | **Unterauftragsverarbeiter** des Betreibers | siehe [unterauftragsverarbeiter.md](unterauftragsverarbeiter.md) |
| Microsoft 365 (falls der Kunde verbindet) | **eigener Auftragsverarbeiter des Kunden** – nicht unserer | Kalender/Mails im Tenant des Kunden |
| Have I Been Pwned (Passwort-Prüfung) | kein Empfänger personenbezogener Daten | nur 5 Zeichen eines SHA-1-Hashes (k-Anonymität) |

## Dokumente

| Datei | Zweck | Für wen |
|---|---|---|
| [avv-vorlage.md](avv-vorlage.md) | Auftragsverarbeitungsvertrag (Art. 28) inkl. Anlagen (Gegenstand, TOM, Unterauftragnehmer) | Vertrag mit jedem Kunden |
| [unterauftragsverarbeiter.md](unterauftragsverarbeiter.md) | Liste, Drittlandtransfer, Prüfstatus | Anlage 3 zum AVV, intern |
| [toms.md](toms.md) | Technische und organisatorische Maßnahmen (Art. 32) – aus dem Code belegt | Anlage 2 zum AVV |
| [verarbeitungsverzeichnis.md](verarbeitungsverzeichnis.md) | VVT als Verantwortlicher (Art. 30 Abs. 1) und als Auftragsverarbeiter (Art. 30 Abs. 2) | intern, Behörde auf Anfrage |
| [loeschkonzept.md](loeschkonzept.md) | Fristen und wie sie technisch umgesetzt sind | intern, Kunden |
| [dsfa.md](dsfa.md) | Teil A: Risikoanalyse der Plattform · Teil B: Vorlage, die der Kunde für seine DSFA nutzen kann | intern, Kunden |
| [anrufer-information.md](anrufer-information.md) | Art.-13-Information für Anrufer (gestuft: Ansage + Webseitentext) | Kunden (Textbaustein) |
| [ki-verordnung.md](ki-verordnung.md) | Einordnung nach EU-KI-Verordnung, Transparenzpflicht, KI-Kompetenz | intern, Kunden |
| [aufzeichnung.md](aufzeichnung.md) | Gesprächsaufzeichnung: Rechtslage, Optionen, Produktverhalten | intern, Anwalt |
| [incident-plan.md](incident-plan.md) | Datenpannen- und Notfallplan | intern |
| [datenschutzerklaerung-plattform.md](datenschutzerklaerung-plattform.md) | Datenschutzerklärung für Portal und Website des Betreibers | öffentlich |
| [impressum-vorlage.md](impressum-vorlage.md) | Impressum (§ 5 DDG) | öffentlich |
| [agb-sla-eckpunkte.md](agb-sla-eckpunkte.md) | Eckpunkte für AGB/Leistungsbeschreibung/SLA | Anwalt |

## Wie Recht im Produkt umgesetzt ist (Belege)

| Pflicht | Umsetzung | Fundstelle |
|---|---|---|
| KI-Offenlegung am Telefon (Art. 50 Abs. 1 KI-VO) | Begrüßung wird erzwungen ergänzt, wenn ein eigener Text die KI nicht nennt | `src/lib/voice/context.ts` → `buildGreeting`, Test `tests/urgency.test.ts` |
| Keine stille Aufzeichnung | Agent ohne Speicherung, wenn Aufzeichnung aus; sonst Hinweis in Begrüßung | `selectAgent`, `RETELL_AGENT_ID_NO_STORAGE` |
| Datenschutzhinweis für Anrufer | Kurzer Hinweis + Verweis auf Datenschutz-URL des Kunden | Einstellung `privacyUrl`, Variable `privacy_notice` |
| Löschfristen | täglicher Job, Löschung auch bei Retell/Twilio | `src/lib/services/retention.ts` |
| Betroffenenrechte (Auskunft, Löschung) | Export und Löschung je Endkunde, inkl. Anbieter | `customers/[id]/export`, `eraseCustomer` |
| AVV vor Produktivbetrieb | Mandant kann erst „Aktiv“ werden, wenn AVV-Version + Datum erfasst sind | `src/lib/services/tenants.ts` |
| Vertragsende | Offboarding: Gesamtexport, danach vollständige Löschung inkl. Anbieter | `admin/tenants/[id]/export`, `DELETE admin/tenants/[id]` |
| Mandantentrennung | `tenantId` serverseitig, Integrationstest | `tests/integration/tenancy.test.ts` |
| Sicherheit Art. 32 | siehe [toms.md](toms.md) und `docs/sicherheit.md` | |

## Offene Punkte vor dem Launch (Kurzliste)

1. **[PRÜFEN]** AVV-Vorlage und TOM durch Fachperson; Haftungs-/Vergütungsregeln ergänzen.
2. DPA/AVV mit IONOS, Twilio, Retell und SMTP-Anbieter **abschließen und ablegen** (Datum in `unterauftragsverarbeiter.md`).
3. **[PRÜFEN]** Retell: Drittlandtransfer ohne DPF-Zertifizierung (Stand Recherche) → SCC + Transfer Impact Assessment; welches LLM/STT/TTS nutzt Retell konkret? Schriftlich anfragen.
4. **[PRÜFEN]** Aufzeichnung: Ansage allein vs. ausdrückliche Einwilligung (siehe [aufzeichnung.md](aufzeichnung.md)). Empfehlung bis zur Klärung: Aufzeichnung standardmäßig **aus**.
5. **[PRÜFEN]** DSFA-Pflicht für Kunden (DSK-Muss-Liste „KI zur Steuerung der Interaktion mit Betroffenen“) → Teil B an Kunden geben.
6. Impressum und Datenschutzerklärung veröffentlichen, URLs in `.env` (`LEGAL_IMPRINT_URL`, `LEGAL_PRIVACY_URL`) eintragen.
7. Incident-Plan ausfüllen (Kontakte) und einmal üben.
8. KI-Kompetenz (Art. 4 KI-VO): Schulungsnachweis für Betreiber-Team, Kurzanleitung für Kunden.
