# Recht – Funktionen, die gebaut sein müssen

> Phase 16 („in Arbeit“), Unterlagen in `docs/recht/` (README dort). Stand 2026-10-24. **Keine Rechtsberatung**; Stellen mit `[PRÜFEN]` muss eine Fachperson klären (TASK-037).

| Pflicht | Umsetzung im Code | Stand / offen | Quelle |
|---|---|---|---|
| KI-Offenlegung (Art. 50 KI-VO) in jeder Begrüßung, nicht abschaltbar | Begrüßungs-Baustein, Test „Keine stille Aufzeichnung“ (`tests/urgency.test.ts`) | gebaut (F-02) | `docs/recht/ki-verordnung.md` |
| Aufzeichnung nur mit Hinweis bzw. Einwilligung (§ 201 StGB) | Einstellung „Einwilligung zur Aufzeichnung“, Tool `recording_consent`, Löschung der Aufnahme bei „Nein“ (`ae31147`) | gebaut; Standard „an mit Ansage“ bis E-010; Löschung beim Anbieter nicht mit echtem Konto belegt | `docs/recht/aufzeichnung.md` |
| DSGVO-Auskunft (Export) | Kundenverwaltung → Export (JSON), Mandanten-Gesamtexport | gebaut (F-14, F-27); nur für berechtigte Kunden-Admins mit Re-Auth | `docs/recht/verarbeitungsverzeichnis.md` |
| DSGVO-Löschung eines Anrufers inkl. Anbieter | `eraseCustomer` (zuerst bei Retell/Twilio/Vapi/ElevenLabs), Abrechnungsdaten anonymisiert | gebaut; Anbieter-Löschung mit echtem Konto offen (TASK-012) | `docs/recht/loeschkonzept.md` |
| Löschfristen je Mandant, Monatsabschluss vor Löschung (GoBD) | `src/lib/services/retention.ts`, `billing-close.ts` (`48e363a`) | gebaut; Frist für Vorgangstexte offen (Entscheidung) | `loeschkonzept.md` §5 |
| Offboarding eines Mandanten | Gesamtexport und -löschung, Schlussabrechnung festgeschrieben | gebaut; Prüfung auf Produktion offen (TASK-036) | `loeschkonzept.md` |
| SMS-Einwilligung und Widerspruch (UWG) | `smsConsent*`, `smsOptOutAt`, Twilio-Fehler 21610 = Widerspruch | gebaut; Rechtsgrundlage offen (TASK-039) | `docs/recht/anrufer-information.md` |
| Terminerinnerungen nur nach Aktivierung | Standard aus (E-008) | gebaut | – |
| Impressum, Datenschutzerklärung im Portal | `LEGAL_IMPRINT_URL`, `LEGAL_PRIVACY_URL`, `src/components/LegalFooter.tsx` | Texte nicht veröffentlicht (TASK-035) | `docs/recht/impressum-vorlage.md`, `datenschutzerklaerung-plattform.md` |
| AVV mit Kunden, Unterauftragsverarbeiter | Vorlage | Verträge mit Anbietern offen (TASK-030, TASK-031) | `avv-vorlage.md`, `unterauftragsverarbeiter.md` |
| TOM, DSFA, Incident-Plan | Dokumente | DSFA-Schwellwertprüfung offen (TASK-032) | `toms.md`, `dsfa.md`, `incident-plan.md` |
| AGB / SLA | Eckpunkte | final offen (TASK-035) | `agb-sla-eckpunkte.md` |

Änderungen an Daten, Anbietern, Fristen oder Texten der KI → betroffene Dateien in `docs/recht/` nachziehen (wesentliche Abweichung, AGENTS.md Abschnitt 7).
