# Barrierefreiheit & Sprachen

> Phase 10 (verkürzt, Modus „Bestehende App“), Stand 2026-10-24. **Ehrlicher Stand:** Geprüft wurde nur, was sich per Code-Suche feststellen lässt. Es gab **keinen** Test mit Screenreader, keine Tastatur-Durchgänge, keine automatische Prüfung (axe/Lighthouse) und keine Kontrastmessung. „✅ im Code“ heißt: Umsetzung gefunden, Wirkung nicht geprüft.

## Rechtliche Einordnung (keine Rechtsberatung)
- **BFSG relevant: voraussichtlich nein für das Portal – prüfen.** Begründung: Das Portal ist ein Werkzeug für Unternehmen (B2B), Verbraucher nutzen es nicht [Q-015]. Der Betreiber ist voraussichtlich ein Kleinstunternehmen, das eine Dienstleistung erbringt – diese sind ausgenommen [ANNAHME A-007].
- **Telefonkanal:** Anrufer sind oft Verbraucher. Ob die KI-Terminvergabe am Telefon eine Dienstleistung im Sinne des BFSG ist (Anbieter wäre dann eher der Betrieb, nicht die Plattform), ist nicht geklärt [PRÜFEN]. Unabhängig davon: Menschen mit Hör- oder Sprechbehinderung können den Sprachkanal nicht nutzen – der Betrieb braucht einen zweiten Kontaktweg (E-Mail, Formular). Das gehört in die Kundeninformation (`docs/recht/anrufer-information.md`).

## Ziel-Standard
WCAG 2.2 AA (Basis) [Q-018] – für das Portal als Qualitätsziel, nicht als Rechtspflicht.

## Checkliste
| Prüfpunkt | Stand | Fundstelle / Grund |
|---|---|---|
| Kontraste geprüft | ❌ nicht geprüft – Glas-Design mit Transparenz, Leuchten und hellgrauer Schrift (`text-zinc-500`) ist besonders gefährdet | `src/app/globals.css`, `tailwind.config.ts`; TASK-042 |
| Alle Bedienelemente per Tastatur erreichbar, sichtbarer Fokus | ⚠️ teilweise – sichtbarer Fokus `:focus-visible` (2 px) vorhanden; Tastaturbedienung von Seitenleisten (Drawer), Wellenform-Player (Pfeiltasten laut Commit `2b31ad6`) und Dialogen nicht durchgetestet | `src/app/globals.css:110` |
| Bilder und Icons mit Textalternative | ⚠️ teilweise – Icon-Navigation mit `aria-label` und `title`, `aria-current` für die aktive Seite; Diagramme (Flächen-/Balkendiagramme) ohne geprüfte Textalternative | `src/components/Sidebar.tsx`, `AreaChart.tsx`, `BarChart.tsx` |
| Formularfelder mit sichtbaren Beschriftungen | ⚠️ zu prüfen – Einstellungsseiten nutzen `Field label=…`; im Code stehen 66 `placeholder=` gegenüber 73 `<label`/`aria-label` – ob jedes Feld beschriftet ist, ist nicht geprüft | `grep` am 2026-10-24; B1 BF-18 |
| Fehlermeldungen als Text, nicht nur farbig | ✅ im Code – Fehler werden als Text ausgegeben (Formulare, Toasts) [ANNAHME A-016] | – |
| Tippflächen mind. 44×44 px | ❌ nicht geprüft (Icon-Leiste, kleine `text-xs`-Schaltflächen) | – |
| Schrift auf 200 % vergrößerbar ohne Funktionsverlust | ❌ nicht geprüft | – |
| Keine Zeitlimits ohne Verlängerung | ⚠️ Sitzungen: Plattform-Admin 30 min Inaktivität / 12 h absolut; Re-Auth nach 15 min für sensible Aktionen – Verlängerung durch erneute Anmeldung, kein Warnhinweis vor Ablauf | `docs/sicherheit.md` „Sitzungen“ |
| Bewegungen respektieren „Bewegung reduzieren“ | ✅ im Code | `src/app/globals.css:154` (`prefers-reduced-motion`) |
| Überschriften-Hierarchie, Seitentitel, Sprache im HTML | ⚠️ `lang="de"` gesetzt; Überschriften-Hierarchie und eindeutige Seitentitel je Seite nicht geprüft | `src/app/layout.tsx:23` |
| Einfache Sprache bei wichtigen Hinweisen | ✅ weitgehend – Hilfetexte in Alltagssprache (z. B. Einstellungen), Fachbegriffe wie „TwiML“ nur im Betreiberbereich | – |
| CAPTCHA mit barrierefreier Alternative | n/a – kein CAPTCHA, Schutz über Rate-Limits | `src/lib/rate-limit.ts` |
| Telefon-KI: verständlich für alle Anrufer | ⚠️ Prompt-Regeln „höchstens zwei Sätze, eine Frage auf einmal, Uhrzeiten natürlich“; Wirkung nur per Testanruf belegbar | `voice-agent/system-prompt.md`, `docs/testanrufe.md` |

**Nächste Schritte:** axe-Prüfung (z. B. über Playwright) in der CI, ein Tastatur-Durchgang für S01, S10, S11, S12, S14, S21, Kontrastmessung der Glas-Farben in hellem und dunklem Thema → TASK-042, TASK-043.

## Sprachen
- Start: **nur Deutsch** (Portal, Telefon-KI, E-Mails, SMS).
- Später: Englisch und Türkisch für die Telefon-KI je Kunde (F-33).
- i18n von Anfang an: **nein** – Texte stehen fest im Code (kein i18n-Paket, keine Sprachdateien). Nachrüsten ist Voraussetzung für F-33 und groß (L) → erst nach dem Launch.
- Sprach-KI: Prompt und Begrüßung fest Deutsch, Datumsformat `de-DE` (`src/lib/voice/context.ts`).

## Formate und Zeit
- Regionen / Zeitzonen: Deutschland; Zeitzone je Mandant einstellbar (Standard `Europe/Berlin`, Feld „Zeitzone“ in S14) [ANNAHME A-005].
- Wochenanfang: Montag (Geschäftstage je Mandant wählbar) [ANNAHME A-008].
- Datum, Zahl, Währung: deutsche Formate über `Intl` (`formatGermanDateTime`), Euro netto mit ausgewiesener USt (`VAT_PERCENT`).
- Zeitbezogene Regeln: Speicherung in UTC, Anzeige und Slot-Berechnung in der Mandanten-Zeitzone, Tagesgrenzen über Kalendertage; Tests für die Umstellung am 25.10.2026 und 29.03.2026 vorhanden (E-015, `tests/time.test.ts`). Termine über Mitternacht gibt es nicht (Slots nur innerhalb der Geschäftszeiten). Die Telefon-KI bekommt Datum und Uhrzeit des Anrufs in Ortszeit (`current_datetime`).
