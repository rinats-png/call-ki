# Gesprächsaufzeichnung – Rechtslage und Produktverhalten

> **Keine Rechtsberatung – diese Frage vor dem Aktivieren für einen Kunden anwaltlich klären [PRÜFEN].** Stand: 2026-10-23.

## 1. Was „Aufzeichnung“ technisch bedeutet

| Was | Ohne Aufzeichnung (Standard) | Mit Aufzeichnung |
|---|---|---|
| Audio fließt live durch Twilio und Retell (für Spracherkennung/-ausgabe) | ja | ja |
| Audioaufnahme gespeichert (Retell, ggf. Twilio) | **nein** – Agent `RETELL_AGENT_ID_NO_STORAGE` („Basic Attributes Only“) | ja, bis zur Löschfrist |
| Transkript/Zusammenfassung in der Plattform | ja **[PRÜFEN: liefert Retell bei „Basic Attributes Only“ das Transkript im Webhook? Falls ja: Mitschrift ≠ Tonaufnahme, aber ebenfalls Inhaltsdaten]** | ja |
| Hinweis in der Begrüßung | nein | ja, erzwungen |

**Mailbox im Fallback:** Ist die KI nicht verfügbar, nimmt die Plattform per Twilio eine Sprachnachricht auf (`src/lib/voice/fallback.ts`). Hier spricht der Anrufer bewusst eine Nachricht auf – das gilt allgemein als unproblematisch, die Aufnahme unterliegt aber derselben Löschfrist **[PRÜFEN]**.

Fehlt `RETELL_AGENT_ID_NO_STORAGE`, verwendet die Plattform den Standard-Agenten **mit** Hinweis – es wird nie ohne Hinweis gespeichert (`selectAgent`).

## 2. Rechtslage (Deutschland), Kurzfassung

- **§ 201 StGB:** Wer das nichtöffentlich gesprochene Wort eines anderen **unbefugt** auf einen Tonträger aufnimmt, macht sich strafbar. Befugt ist die Aufnahme insbesondere mit **Einwilligung**.
- **DSGVO:** Die Datenschutzkonferenz sieht für Gesprächsaufzeichnungen regelmäßig nur die **Einwilligung** (Art. 6 Abs. 1 lit. a) als tragfähig an; berechtigte Interessen (lit. f) sind umstritten. Eine Einwilligung muss freiwillig, informiert, eindeutig und **nachweisbar** sein.
- **Bloße Ansage + Weitersprechen** („Das Gespräch wird aufgezeichnet“) wird verbreitet genutzt, ist als *konkludente* Einwilligung aber **rechtlich unsicher**.
- Transkription ohne Tonspeicherung fällt nicht unter § 201 StGB (kein Tonträger) **[PRÜFEN]**, bleibt aber Verarbeitung nach DSGVO (Rechtsgrundlage lit. b/f, Information nach Art. 13).

## 3. Optionen

| Option | Beschreibung | Rechtssicherheit | Aufwand im Produkt |
|---|---|---|---|
| **A – Keine Aufzeichnung** (Standard) | nur Mitschrift/Zusammenfassung | höchste | vorhanden |
| B – Ansage, Weitersprechen gilt als Zustimmung | Hinweis in der Begrüßung, Opt-out: „Sagen Sie ‚ohne Aufnahme‘“ | mittel – umstritten | Hinweis vorhanden; **Opt-out mitten im Gespräch nicht umgesetzt** (Agent kann die Speicherung nicht nachträglich abschalten; wäre über Löschung des Anrufs direkt nach Ende lösbar) |
| C – Ausdrückliche Einwilligung | KI fragt „Darf ich das Gespräch aufzeichnen?“; bei Nein keine Speicherung | hoch | **umgesetzt (2026-10-24)**: Einstellung „Einwilligung zur Aufzeichnung → Ausdrücklich fragen“. Die Antwort hält das Tool `recording_consent` mit Zeitpunkt am Anruf fest (`Call.recordingConsent`, `recordingConsentAt`). Bei „Nein“ oder ohne klare Antwort entfernt die Plattform nach Gesprächsende den Aufnahme-Link und löscht den Anruf beim Anbieter; die Mitschrift bleibt für den Vorgang. Noch mit echten Anrufen zu testen (`docs/testanrufe.md`). |

**Empfehlung:** Bis zur anwaltlichen Klärung Option **A** für alle Kunden. Wird Aufzeichnung gebraucht (z. B. Qualitätssicherung), nur mit Option C („Ausdrücklich fragen“) aktivieren. **Offene Entscheidung:** Der Standard in der Software ist noch „Aufzeichnung an, nur ansagen“ – Umstellung auf „aus“ bzw. „fragen“ als Standard steht aus.

## 4. Fragen an die Fachperson
1. Reicht Option B für § 201 StGB und Art. 6 DSGVO bei eingehenden Geschäftsanrufen?
2. Ist die Einwilligung gegenüber einer KI (Sprachantwort „Ja“) ausreichend nachweisbar, wenn das Transkript gespeichert wird?
3. Ist die reine Transkription ohne Tonspeicherung mit Information nach Art. 13 auf lit. b/f stützbar?
4. Gilt für Mitarbeiter des Kunden, die per Weiterleitung ins Gespräch kommen, etwas Zusätzliches (Beschäftigtendatenschutz, ggf. Betriebsrat)?
