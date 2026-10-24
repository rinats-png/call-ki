# Monetarisierung & Kosten

> Phase 17 (`phases/17-monetarisierung-und-kosten.md`) für die bestehende App. Stand: 2026-10-24. Schließt OP-17-01 (Kostenrechnung je Minute mit Quellen, Marge je Paket).
> **Alle Preise netto, ohne Umsatzsteuer.** Anbieterpreise sind in US-Dollar gelistet und hier mit **1 USD = 0,88 €** umgerechnet (Annahme, EUR/USD ≈ 1,14; Kurs schwankt, siehe [Q-036]).
> **Wichtig zur Belegqualität:** Die Anbieterseiten (twilio.com, retellai.com, vapi.ai, elevenlabs.io, ionos.de) waren aus der Arbeitsumgebung nicht direkt abrufbar (Proxy). Alle Preise stammen aus einer Websuche am 2026-10-24 (Ergebnis-Auszüge der offiziellen Seiten bzw. Drittquellen). Jeder Preis ist deshalb vor Vertragsschluss und vor dem Launch im jeweiligen Anbieterkonto zu bestätigen **[PRÜFEN]**. Unsichere Werte sind mit ⚠️ markiert.
> Quellen stehen in `QUELLEN.md` und werden hier mit `[Q-…]` zitiert (am 2026-10-24 aus den früheren lokalen Kennungen `QK-01`…`QK-15` übernommen, Zuordnung im Abschnitt „Quellen“ unten).

## Modell

- **B2B-Abo** je Mandant (Unternehmer, § 14 BGB): Paketpreis mit Freiminuten, Mehrminuten je Minute, optionale Einrichtungsgebühr; Module als Zusatzabos (Vorschlag aus `pricing.json` des Prototyps).
- Kein Store-Verkauf (Web-App), daher **keine Store-Provisionen und keine In-App-Kauf-Pflicht**. Zahlungsweg (SEPA/Karte über Zahlungsanbieter) ist noch offen (OP-17-04, OP-15-07); Gebühren des Zahlungsanbieters sind unten nicht eingerechnet (typisch 1–3 % je Zahlung, **[PRÜFEN]** je Anbieter).
- Abrechnung in der App: `src/lib/billing.ts` – Minuten je Gespräch auf den Takt (`billingIncrementSec`, Standard 60 s) aufgerundet, Dauer laut Twilio (`twilioDurationSec`), eigene Kosten über `costFor()` mit den Einstellungen `COST_TELEPHONY_CENTS_PER_MIN` (Standard 1,5), `COST_VOICE_CENTS_PER_MIN` (10) und `COST_SMS_CENTS` (10).

## Preise (Vorschlag, aus `pricing.json`)

| Paket | Preis/Monat | Einrichtung | Freiminuten | Mehrminute | Rufnummern |
|---|---|---|---|---|---|
| Starter | 49 € | 0 € | 100 | 0,39 € | 1 |
| Business | 129 € | 99 € | 400 | 0,32 € | 2 |
| Premium | 299 € | 199 € | 1.200 | 0,27 € | 5 |

Rabatte laut Vorschlag: Gründerkunden 30 % für 12 Monate, jährliche Zahlung „2 Monate gratis“ (≈ 16,7 %).

## Verkaufsweg und Store-Gebühren

| Plattform / Weg | Konto-Gebühr | Provision | In-App-Kauf-Pflicht? | Zahlungsanbieter-Gebühr | Nettoerlös pro Verkauf |
|---|---|---|---|---|---|
| Web-App, Rechnung/SEPA über eigenen Zahlungsanbieter | entfällt | entfällt | nein | 1–3 % **[PRÜFEN]** | Paketpreis abzüglich Zahlungsgebühr |

Verweis: `guides/appstore-veroeffentlichung.md` Abschnitt 8 trifft nicht zu (kein Store).

## Einkaufspreise je Baustein

### Telefonie (Twilio, alle Sprach-KI-Anbieter)

Der Weg eines Anrufs: Kunden-Rufumleitung → **Twilio-Nummer (eingehend)** → `/api/twilio/voice` → Übergabe an die Sprach-KI per **SIP** (Retell `<Dial><Sip>`, Vapi `<Dial><Sip>`) bzw. **Media Stream** (ElevenLabs `register-call`), siehe `src/lib/voice/handoff.ts`. Die Rufumleitung beim Kunden zahlt der Kunde bei seinem eigenen Netzbetreiber.

| Posten | Preis laut Quelle | in € | Quelle | Sicherheit |
|---|---|---|---|---|
| Eingehende Minute, deutsche Ortsnetznummer | 0,0100 USD/min | 0,88 ct/min | [Q-001] | mittel |
| SIP-Verbindung (TwiML `<Dial><Sip>`) bzw. Media Streams | 0,0040 USD/min (bis 100.000 min/Monat) | 0,35 ct/min | [Q-027] | mittel (aus Länderseiten anderer Länder, für DE ⚠️) |
| **Summe Telefonie je KI-Minute** | 0,0140 USD/min | **1,23 ct/min** | | |
| Ortsnetznummer Deutschland | 1,35 USD/Monat | 1,19 €/Monat | [Q-001] | mittel; zusätzlich Regulatory Bundle mit Adressnachweis nötig ([Q-037]) |
| Mobilfunknummer Deutschland (SMS-fähig) | 30,00 USD/Monat | 26,40 €/Monat | [Q-001] | ⚠️ niedrig |
| Ausgehend ins deutsche Festnetz (Weiterleitung, Fallback) | 0,0283 USD/min | 2,49 ct/min | [Q-001] | mittel |
| Ausgehend in deutsche Mobilnetze (Notfall-Weiterleitung, Fallback aufs Handy) | 0,3763 USD/min | **33,1 ct/min** | [Q-001] | ⚠️ niedrig – Wert aus Suchauszug, unplausibel hoch wirkend, unbedingt im Twilio-Konto prüfen |
| Taktung | Twilio rechnet Sprachminuten je Gespräch aufgerundet ab ⚠️ | – | Annahme, **[PRÜFEN]** | niedrig |

Die Code-Annahme `COST_TELEPHONY_CENTS_PER_MIN = 1,5` liegt etwa 0,3 ct über der Rechnung und deckt die Aufrundung kurzer Gespräche ab – **beibehalten**.

### Sprach-KI je Minute (drei Konfigurationen je Anbieter)

Telefonie läuft über das eigene Twilio-Konto, deshalb fällt bei den KI-Anbietern **keine** eigene Telefoniegebühr an (Retell: 0 USD mit eigenem SIP-Trunk, [Q-003]; Vapi: Telefonie wird nur bei Vapi-Nummern berechnet, [Q-031] ⚠️).

**Retell** ([Q-003], [Q-029], [Q-030])

| Konfiguration | Voice-Infrastruktur | Stimme (TTS) | Sprachmodell (LLM) | Summe USD | Summe ct |
|---|---|---|---|---|---|
| günstig: Plattform-Stimme, kleines Modell | 0,055 | 0,015 | 0,006 (Annahme, kleines Modell ⚠️) | 0,076 | 6,7 |
| typisch: Plattform-Stimme, GPT-4.1 | 0,055 | 0,015 | 0,045 | 0,115 | 10,1 |
| teuer: ElevenLabs-Stimme, GPT-4.1 | 0,055 | 0,040 | 0,045 | 0,140 | 12,3 |

Zusätzlich: 20 gleichzeitige Gespräche frei, jedes weitere 8 USD/Monat ([Q-038] ⚠️); Zusatzfunktionen (z. B. KI-Qualitätsprüfung) extra. Retell nennt selbst eine Spanne von 0,07–0,31 USD/min ([Q-003]).

**Vapi** ([Q-031], [Q-032]) – Plattformgebühr plus Einzelanbieter (zu Selbstkosten bzw. mit eigenem Schlüssel)

| Konfiguration | Plattform | Spracherkennung (STT) | LLM | Stimme (TTS) | Summe USD | Summe ct |
|---|---|---|---|---|---|---|
| günstig: Deepgram, GPT-4o mini, günstige Stimme | 0,05 | 0,0048 | 0,001 | 0,040 | 0,096 | 8,4 |
| typisch | 0,05 | 0,010 | 0,020 (Annahme ⚠️) | 0,050 | 0,130 | 11,4 |
| teuer: ElevenLabs-Stimme, großes Modell | 0,05 | 0,010 | 0,045 | 0,070 | 0,175 | 15,4 |

Die TTS-Kosten hängen von der gesprochenen Textmenge ab (Abrechnung je Zeichen); die Werte sind Schätzungen aus Drittquellen ⚠️.

**ElevenLabs Agents** ([Q-005], [Q-033]) – Minutenpreis je Paket, LLM zusätzlich

| Konfiguration | Agents-Minute | LLM | Summe USD | Summe ct |
|---|---|---|---|---|
| günstig: kleines Modell | 0,080 | 0,001 | 0,081 | 7,1 |
| typisch | 0,080 | 0,010 (Annahme ⚠️) | 0,090 | 7,9 |
| teuer: großes Modell | 0,080 | 0,045 | 0,125 | 11,0 |
| Spitze: über dem Gleichzeitigkeits-Limit („Burst“) | 0,160 | 0,045 | 0,205 | 18,0 |

Die 0,08 USD entsprechen dem Business-Paket (990 USD/Monat für 12.375 Minuten, 40 gleichzeitige Gespräche); in kleineren Paketen ist die Minute nur bei voller Ausnutzung so günstig ⚠️. **Vorab bezahlte, nicht genutzte Minuten sind Fixkosten.**

### SMS (Twilio, Deutschland)

| Posten | Preis laut Quelle | in € | Quelle | Sicherheit |
|---|---|---|---|---|
| Ausgehende SMS je Segment (160 Zeichen; mit Umlauten/Emoji 70) | 0,1120 USD | **9,9 ct** | [Q-028] | mittel (andere Twilio-Seite nennt 0,0940 USD = 8,3 ct, vermutlich älter) |
| Fehlgeschlagene SMS | 0,001 USD | 0,09 ct | [Q-028] | mittel |

Die frühere Code-Annahme `COST_SMS_CENTS = 8` war zu niedrig; seit Commit `48e363a` ist der Standard **10**. Erinnerungs- und Bestätigungs-SMS mit Umlauten können zwei Segmente brauchen (dann ≈ 20 ct).

### Hosting, Backups, Betrieb (Fixkosten der Plattform)

| Posten | Preis | Quelle | Sicherheit |
|---|---|---|---|
| IONOS VPS Linux L (4 vCores, 8 GB RAM, 240 GB) | 15 USD/Monat laut US-Seite; €-Preis für DE **[PRÜFEN]**, hier mit 15 €/Monat gerechnet | [Q-034] | niedrig ⚠️ |
| IONOS S3 Object Storage (Backups) | 0,015 €/GB/Monat (ältere Angabe) bzw. ≈ 0,005 USD/GB; ausgehender Traffic kostet | [Q-035] | niedrig ⚠️ |
| Backupvolumen | 30 Tage × tägliche Dumps, geschätzt < 5 GB → < 0,10 €/Monat | Annahme | – |
| Domain, SMTP-Postfach, externer Lebenszeichen-Dienst, Uptime-Check | zusammen ca. 5–10 €/Monat (Gratis-Stufen möglich) | Annahme **[PRÜFEN]** | niedrig |
| **Summe Fixkosten Plattform** | **≈ 25 €/Monat** (ohne vorausbezahlte KI-Pakete, ohne Personal) | | |

Einmalig und nicht monatlich eingerechnet: Rechtsprüfung von AVV/AGB/Datenschutzerklärung, Steuerberatung, ggf. Microsoft-Publisher-Verifizierung – Angebote einholen (Annahme, keine Zahl ohne Beleg).

## Kosten je Gesprächsminute – drei Szenarien

| Szenario | Annahme | Telefonie | Sprach-KI | **Summe je Minute** |
|---|---|---|---|---|
| **Günstig** | Retell, Plattform-Stimme, kleines Modell | 1,23 ct | 6,7 ct | **≈ 7,9 ct** |
| **Typisch** | Retell typisch bzw. Vapi typisch; entspricht den Code-Standards 1,5 + 10 ct | 1,5 ct | 10,0 ct | **≈ 11,5 ct** |
| **Teuer** | Vapi teuer (ElevenLabs-Stimme, großes Modell) | 1,23 ct | 15,4 ct | **≈ 16,6 ct** |
| Ausreißer | ElevenLabs „Burst“ über dem Gleichzeitigkeits-Limit | 1,23 ct | 18,0 ct | ≈ 19,3 ct |

**Kostentreiber außerhalb der KI-Minute** (nicht im Minutenpreis enthalten, aber real):
- **Weiterleitungen** (Notfall-Durchstellung, Fallback bei Störung, Kontingent erschöpft mit Modus `BLOCK`): ausgehende Twilio-Minute ins Festnetz ≈ 2,5 ct, **ins Mobilnetz laut Quelle ≈ 33 ct** ⚠️. Ein Anruf, der wegen erschöpftem Kontingent auf das Handy des Kunden geht, kostet uns dann mehr als eine KI-Minute und bringt keinen Umsatz. → Weiterleitungsminuten getrennt erfassen und in den AGB als kostenpflichtig regeln oder auf Festnetzziele beschränken **[PRÜFEN]**. Ob die KI-Minute während einer Durchstellung weiterläuft, hängt vom Anbieter ab **[PRÜFEN]**.
- **Rufnummern**: 1,19 € je Ortsnetznummer und Monat; SMS-fähige Mobilnummer ⚠️ 26,40 €/Monat (einmal plattformweit als Absender, nicht je Kunde).
- **Abrechnungsdifferenz**: Kunden werden je angefangener Minute abgerechnet, `costFor()` rechnet mit Sekunden. Für die Kostenplanung unten werden konservativ die abgerechneten Minuten als Einkaufsminuten angesetzt.

## Laufende Kosten (Plattform, Schätzung, Preise prüfen)

Szenarien nach Kundenzahl, Mischkalkulation: alle Kunden im Business-Paket, 300 genutzte Minuten je Kunde und Monat (75 % der Freiminuten, Annahme), Kostenszenario „Typisch“ (11,5 ct/min), 2 Rufnummern je Kunde.

| Posten | 10 Kunden | 100 Kunden | 1.000 Kunden | Gratis-Grenze |
|---|---|---|---|---|
| Gesprächsminuten (Telefonie + KI) | 345 € | 3.450 € | 34.500 € | Retell 10 USD Startguthaben ([Q-038]), Vapi laut Forum 1.000 Minuten ([Q-031]) ⚠️ |
| Rufnummern | 24 € | 238 € | 2.380 € | keine |
| SMS (50 je Kunde, 10 ct) | 50 € | 500 € | 5.000 € | keine |
| Hosting, Backups, Dienste | 25 € | 60 € (größerer VPS, Annahme) | 400 € (mehrere Server, Annahme) | – |
| Gleichzeitigkeit Retell (> 20 Gespräche) | 0 € | ca. 0–70 € | ca. 700 € (Annahme: 100 zusätzliche Kanäle) ⚠️ | 20 Kanäle frei |
| **Summe** | **≈ 444 €** | **≈ 4.300 €** | **≈ 43.000 €** | |
| Umsatz (129 € je Kunde) | 1.290 € | 12.900 € | 129.000 € | |

## Marge je Paket

Annahmen: Kunde nutzt **alle** Freiminuten (schlechtester Fall für das Paket), keine SMS, Plattform-Fixkosten auf 20 Kunden verteilt (1,25 € je Kunde), Rufnummern 1,19 € je Stück. Einrichtungsgebühr nicht eingerechnet.

| Paket | Preis | Kosten günstig | Kosten typisch | Kosten teuer | Marge günstig | **Marge typisch** | Marge teuer |
|---|---|---|---|---|---|---|---|
| Starter (100 min, 1 Nr.) | 49 € | 10,34 € | 13,94 € | 19,04 € | 38,66 € (79 %) | **35,06 € (72 %)** | 29,96 € (61 %) |
| Business (400 min, 2 Nr.) | 129 € | 35,23 € | 49,63 € | 70,03 € | 93,77 € (73 %) | **79,37 € (62 %)** | 58,97 € (46 %) |
| Premium (1.200 min, 5 Nr.) | 299 € | 102,00 € | 145,20 € | 206,40 € | 197,00 € (66 %) | **153,80 € (51 %)** | 92,60 € (31 %) |

**Mit Rabatten (typisch):**

| Paket | Gründerkunde (−30 %) | Marge | Jahreszahlung (÷12×10) | Marge |
|---|---|---|---|---|
| Starter | 34,30 € | 20,36 € (59 %) | 40,83 € | 26,89 € (66 %) |
| Business | 90,30 € | 40,67 € (45 %) | 107,50 € | 57,87 € (54 %) |
| Premium | 209,30 € | 64,10 € (31 %); teuer: 2,90 € (1 %) | 249,17 € | 103,97 € (42 %) |

**Mehrminuten** (Preis − Einkauf je Minute):

| Paket | Mehrminute | Marge typisch (11,5 ct) | Marge teuer (16,6 ct) |
|---|---|---|---|
| Starter | 0,39 € | 27,5 ct (71 %) | 22,4 ct (57 %) |
| Business | 0,32 € | 20,5 ct (64 %) | 15,4 ct (48 %) |
| Premium | 0,27 € | 15,5 ct (57 %) | 10,4 ct (39 %) |

**Bewertung (ehrlich):**
- Die Pakete tragen im typischen Szenario. Kritisch ist **Premium mit teurer KI-Konfiguration** (eigener Agent mit ElevenLabs-Stimme und großem Modell): nur 31 % Marge, mit Gründerrabatt praktisch null. → Premium-Kunden mit „eigenem Agenten“ nur mit einer Konfiguration bis höchstens ca. 12 ct/min zulassen oder den Preis anheben.
- **Module mit SMS sind unter Einkauf kalkuliert:** Z01 „SMS 0,09 €“ und Z02 „weitere 0,08 € je Erinnerung“ liegen unter den ≈ 9,9 ct einer SMS (bei zwei Segmenten ≈ 20 ct). → SMS-Preis auf mindestens 0,15 € je SMS bzw. Erinnerungen per SMS nur innerhalb eines Kontingents.
- Die Annahme im Prototyp „ca. 0,12–0,15 € je Minute“ ist für das typische Szenario etwas konservativ (11,5 ct) und für das teure etwas zu niedrig (16,6 ct).

## Feste Kosten

- Plattform-Fixkosten ≈ 25 €/Monat (oben); ElevenLabs-Business-Paket (990 USD/Monat) nur buchen, wenn genug ElevenLabs-Kunden da sind – sonst kleineres Paket, Pay-as-you-go oder Retell/Vapi.
- Keine Store-Gebühren. Domain, Rechtstexte und Steuerberatung siehe oben.
- Pflege nach dem Start: Support-Zeit (`docs/support-playbook.md`), Anbieter-Updates, Testanrufe je Release (`docs/release-checkliste.md`).

## Kostenlimits & Alarme

Technisch umgesetzt (Belege in `docs/betrieb.md` → „Kostenschutz“): Notschalter, gleichzeitige Anrufe je Kunde (5) und gesamt (50), maximale Gesprächsdauer (20 Min.), Tagesbudget der Plattform mit 80/100-%-Alarm, Kontingent-Warnungen 80/100 % je Kunde, Alarm bei 200 % für Kunden ohne Grenze.

| Dienst | Alarm bei | Harte Grenze | Limit pro Kunde |
|---|---|---|---|
| Twilio | Usage Trigger bei 50/80/100 % des Monatsbudgets ☐ einrichten | Auto-Recharge aus, Guthaben begrenzt ☐ | `monthlyMinuteLimit`, gleichzeitige Anrufe 5 |
| Retell | Ausgabenalarm im Dashboard ☐ | Guthaben-Obergrenze ☐ **[PRÜFEN: Funktion vorhanden?]** | wie oben |
| Vapi | Ausgabenalarm ☐ | Guthaben-Obergrenze ☐ **[PRÜFEN]** | wie oben |
| ElevenLabs | Nutzungswarnung ☐ | Paketgrenze, Burst/Überzug abschalten ☐ **[PRÜFEN]** | wie oben |
| Plattform | Tagesbudget 80 % | Tagesbudget 100 % → Fallback | Kontingent 80/100 %, `BLOCK`-Modus |

Empfehlung für die Plattform-Einstellungen (Verwaltung → Plattform): `COST_TELEPHONY_CENTS_PER_MIN = 1.5` (bleibt), `COST_VOICE_CENTS_PER_MIN` je nach genutztem Anbieter (Retell typisch 10, Vapi 11,5, ElevenLabs 8; bei Premium-Agenten bis 15,5), `COST_SMS_CENTS = 10`. Da `costFor()` nur **einen** KI-Wert für alle Anbieter kennt, ist eine Einstellung je Anbieter sinnvoll (Aufgabe für Phase 21, keine Code-Änderung in diesem Dokument).

## Wirtschaftlichkeit (Rechnung)

Deckungsbeitrag je Kunde (typisch, voll genutzte Freiminuten, ohne Fixkostenanteil): Starter 36,31 € · Business 80,62 € · Premium 155,05 €.

| Monatliche Fixkosten | Was enthalten | Break-even (nur Business-Kunden) | Break-even (nur Starter) |
|---|---|---|---|
| 25 € | nur Infrastruktur | 1 Kunde | 1 Kunde |
| 200 € (Annahme) | + Steuerberatung, Versicherung, Werkzeuge | 3 Kunden | 6 Kunden |
| 3.200 € (Annahme) | + eigenes Gehalt/Entnahme 3.000 € | 40 Kunden | 89 Kunden |

Rechnung: Fixkosten ÷ Deckungsbeitrag, aufgerundet. Mit Gründerrabatt (Business 41,92 € Deckungsbeitrag) verdoppelt sich die Kundenzahl in der letzten Zeile auf 77. Nutzt der Durchschnittskunde nur 75 % seiner Freiminuten, steigt der Business-Deckungsbeitrag auf ≈ 92 €.

**Offene Punkte aus dieser Phase:**
- Alle ⚠️-Preise im echten Konto bestätigen, insbesondere Twilio Mobilnetz-Terminierung, Twilio-Taktung, ElevenLabs-Paket und Retell-LLM-Preise **[PRÜFEN]**.
- Abgleich der eigenen Minutenzählung mit der Anbieter-Abrechnung vor der ersten Rechnung (OP-17-03).
- Weiterleitungsminuten (Notfall, Fallback) messen und bepreisen.
- SMS-Preise der Module anheben (s. o.).
- Zahlungsanbieter und dessen Gebühren festlegen (OP-17-04).

## Quellen

Alle Abrufe am **2026-10-24** über eine Websuche (die Anbieterseiten selbst waren aus der Arbeitsumgebung gesperrt). Die Einträge sind nach `QUELLEN.md` übernommen (Aussage, URL, Art, Verlässlichkeit, „neu prüfen bis“: vor dem Launch, spätestens 2027-01-31). Wo dieselbe Anbieterseite schon einen Eintrag hatte, wurden die Beträge dort ergänzt statt doppelt angelegt (Q-001, Q-003, Q-005).

Zuordnung der früheren lokalen Kennungen: QK-01 → [Q-001] · QK-02 → [Q-027] · QK-03 → [Q-028] · QK-04 → [Q-003] · QK-05 → [Q-029] · QK-06 → [Q-030] · QK-07 → [Q-031] · QK-08 → [Q-032] · QK-09 → [Q-005] · QK-10 → [Q-033] · QK-11 → [Q-034] · QK-12 → [Q-035] · QK-13 → [Q-036] · QK-14 → [Q-037] · QK-15 → [Q-038].
