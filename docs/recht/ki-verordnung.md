# Einordnung nach der EU-KI-Verordnung (VO (EU) 2024/1689)

> **Keine Rechtsberatung.** Stand: 2026-10-23. Zeitplan und Leitlinien der Kommission ändern sich (u. a. „Digital Omnibus“); vor dem Launch aktuellen Stand prüfen **[PRÜFEN]**.

## 1. Ist das ein KI-System?
Ja. Der Sprachagent erzeugt aus Eingaben (Sprache) Ausgaben (Antworten, Zusammenfassungen, Dringlichkeit, Funktionsaufrufe) und arbeitet mit einem gewissen Grad an Autonomie (Art. 3 Nr. 1).

## 2. Rollen
| Wer | Rolle | Begründung |
|---|---|---|
| Retell AI / zugrunde liegende Modellanbieter | Anbieter des KI-Modells bzw. der Komponente; LLM-Anbieter ggf. Anbieter eines **KI-Modells mit allgemeinem Verwendungszweck** (Kapitel V) | stellt das Modell bereit |
| **Betreiber der Plattform** `<Betreiber>` | voraussichtlich **Anbieter** des KI-Systems „KI-Telefonassistenz“ | bringt das System unter eigenem Namen in Verkehr / stellt es bereit (Art. 3 Nr. 3) **[PRÜFEN]** |
| **Kunde** | **Betreiber** (engl. *deployer*, Art. 3 Nr. 4) | verwendet das System in eigener Verantwortung beruflich |

## 3. Risikoklasse
| Prüfung | Ergebnis |
|---|---|
| Verbotene Praktiken (Art. 5) | nein – keine Manipulation, kein Social Scoring, **keine Emotionserkennung** (der Agent wertet keine Emotionen aus; Retell-Funktionen zur Stimmungsanalyse nicht aktivieren) **[PRÜFEN: Retell-Einstellung „sentiment“ im Agenten deaktiviert?]** |
| Hochrisiko nach Anhang III Nr. 5 lit. d (Bewertung und Klassifizierung von **Notrufen**, Disposition von Not- und Rettungsdiensten, Triage im Gesundheitswesen) | **nein** – die Plattform nimmt geschäftliche Anrufe an. Sie bewertet die Dringlichkeit nur für die interne Reihenfolge des Kunden (z. B. Wespennest am Kinderspielplatz) und leitet an Mitarbeiter des Kunden weiter. Bei Lebensgefahr verweist sie auf 112; sie disponiert keine Rettungsdienste. **Bedingung:** Die Plattform darf **nicht** für Notrufannahme, Rettungsdienste, ärztlichen Bereitschaftsdienst o. ä. verkauft werden (AGB-Ausschluss, `agb-sla-eckpunkte.md`) |
| Hochrisiko nach Anhang III sonst (Beschäftigung, Kreditwürdigkeit …) | nein |
| **Transparenzpflichten (Art. 50)** | **ja** – siehe 4 |

## 4. Pflichten und Umsetzung

| Pflicht | Gilt seit | Wer | Umsetzung |
|---|---|---|---|
| **Art. 50 Abs. 1**: Personen, die mit einem KI-System interagieren, werden informiert, dass sie mit einer KI sprechen – spätestens bei der ersten Interaktion, klar und erkennbar | 2. August 2026 | Anbieter | Begrüßung enthält immer „digitale (KI-)Assistenz“; eigener Begrüßungstext des Kunden wird automatisch ergänzt (`buildGreeting`, Test in `tests/urgency.test.ts`); Systemprompt verbietet, sich als Mensch auszugeben |
| Art. 50 Abs. 2: Kennzeichnung synthetischer Audioinhalte (maschinenlesbar) | 2. August 2026 | Anbieter | betrifft vorrangig generierte Audio-/Medieninhalte; für Live-Gespräche durch Abs. 1 abgedeckt **[PRÜFEN: Leitlinien/Verhaltenskodex der Kommission]** |
| Art. 50 Abs. 3: Information über Emotionserkennung | 2. August 2026 | Betreiber | entfällt – keine Emotionserkennung |
| **Art. 4: KI-Kompetenz** | 2. Februar 2025 | Anbieter **und** Betreiber | Betreiber-Team: Schulung dokumentieren ☐. Kunden: Kurzanleitung „So arbeitet die KI-Assistenz, Grenzen, wann ein Mensch übernimmt“ im Onboarding ☐ |
| Art. 26 (Betreiberpflichten Hochrisiko) | – | – | entfällt, kein Hochrisiko |

## 5. Weitere Festlegungen
- **Mensch kann übernehmen:** Wunsch nach Mitarbeiter → Rückrufvorgang oder Weiterleitung (`book_appointment` ohne Termin als „Rückrufwunsch“, Tool `escalate_emergency` für Notfälle).
- **Keine verbindlichen Zusagen durch die KI** zu Preisen und Leistungen; Termine nur über die geprüfte Buchungsfunktion.
- **Protokoll:** Transkript und Funktionsaufrufe je Anruf, bis zur Löschfrist – erlaubt Nachvollziehen von Fehlern.
- **Änderungen am Prompt** (`voice-agent/system-prompt.md`) sind versioniert im Repository; vor Änderung der Offenlegung immer Test laufen lassen.
