# Qualität & Tests

> Phase 19 im Modus „Bestehende App“. Funktionen `F-…` aus `05-mvp.md`, Bedrohungen `BD-…` aus `14-sicherheit.md`, Aufgaben `TASK-…` in `21-roadmap.md`. Testnamen sind wörtlich aus dem Repository übernommen (Stand 2026-10-24, Commit `33c0708`).
> **Lesart der Spalte „Stand“ in der Testliste:** *vorhanden* = automatischer Test im Repository, läuft in der CI · *offen* = noch zu schreiben · *manuell* = Testanruf bzw. Prüfung mit Datum nach `docs/testanrufe.md`. Das Prüfskript sieht nur, dass ein Test eingetragen ist, nicht, ob er existiert oder etwas Sinnvolles prüft.

## Akzeptanzkriterien und Tests

### F-01 Anrufannahme und Übergabe an die Sprach-KI
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F01-1 | Gegeben eine einem Mandanten zugeordnete Twilio-Nummer, wenn ein Anruf eingeht, dann entsteht eine Anrufzeile in diesem Mandanten und der Anruf geht an den Anbieter nach der Regel „Nummer vor Kunde vor Standard“; mit echten Konten je Anbieter (Retell, Vapi, ElevenLabs) nachgewiesen | TEST-F01-1, TEST-F01-2, TEST-F01-3, TEST-F01-4 | Integration, Unit, manuell, Vertrag |
| AK-F01-2 | Gegeben ein Twilio-Aufruf ohne gültige Signatur, dann antwortet die App mit `403` und legt keinen Anruf an – auch wenn `TWILIO_VALIDATE_SIGNATURE=false` in Produktion gesetzt ist | TEST-F01-5, TEST-F01-6 | Unit, HTTP |

### F-02 KI-Offenlegung und Aufzeichnungshinweis
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F02-1 | Gegeben eine beliebige (auch eigene) Begrüßung, dann legt sie offen, dass eine KI spricht; wird aufgezeichnet, folgt der Hinweis bzw. bei Variante C die Frage; ohne Agent ohne Speicherung wird nie still aufgezeichnet | TEST-F02-1, TEST-F02-2, TEST-F02-3 | Unit, manuell |
| AK-F02-2 | Gegeben eine Datenschutz-URL, dann nennt die KI sie sprechbar; ohne URL bietet sie die Zusendung an | TEST-F02-4 | Unit |

### F-03 Anrufer-Erkennung nur über verifizierte Nummer
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F03-1 | Gegeben ein Anruf von Nummer X, wenn die KI Kundendaten zu Nummer Y abfragt, dann liefert `identify_caller` nur Daten zu X; eine genannte Nummer wird gespeichert, überschreibt aber nichts und wird nicht zurückgemeldet | TEST-F03-1, TEST-F03-2, TEST-F03-5 | Integration, Unit, manuell |
| AK-F03-2 | Gegeben dieselbe Rufnummer bei zwei Mandanten, dann sieht jeder Mandant nur seinen eigenen Kunden und Vorgang; Nummern werden einheitlich nach E.164 normalisiert | TEST-F03-3, TEST-F03-4 | Integration, Unit |

### F-04 Anliegen aufnehmen
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F04-1 | Gegeben ein Anliegen, wenn `book_appointment`/`save_customer` aufgerufen werden, dann entsteht genau ein Vorgang je Anruf mit Kategorie, Dringlichkeit und Vorgangsnummer; alte Kundentyp-Werte werden richtig abgebildet; Agent-Tools und Server-Schema stimmen überein | TEST-F04-1, TEST-F04-2, TEST-F04-3, TEST-F04-4 | Integration, Unit |

### F-05 Terminvorschläge und Buchung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F05-1 | Gegeben eine PLZ, dann schlägt die KI freie Termine des zuständigen Mitarbeiters vor; ein gerade vergebener Termin wird nicht doppelt gebucht; fremde Mitarbeiter-IDs aus der KI werden ignoriert; mit Outlook/Google echt nachgewiesen | TEST-F05-1, TEST-F05-3, TEST-F05-4, TEST-F05-5 | Unit, Integration, manuell |
| AK-F05-2 | Gegeben ein Termin rund um die Zeitumstellung (25.10.2026, 29.03.2026), dann erscheinen Slots zur richtigen Ortszeit; Monats- und Tagesgrenzen gelten in Ortszeit | TEST-F05-2 | Unit |

### F-06 Termin per Telefon verschieben oder absagen
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F06-1 | Gegeben ein Anrufer mit kommendem Termin, wenn er verschiebt oder absagt, dann geht das nur für Termine seiner verifizierten Nummer; eine Vorgangsnummer allein reicht nicht | TEST-F06-1, TEST-F06-2 | Integration, manuell |

### F-07 Notfall
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F07-1 | Gegeben eine Notfallschilderung der Branche, dann stuft der Server sie als `CRITICAL` ein (verneinte Stichwörter zählen nicht) und routet an den Notdienst mit Durchstellnummer | TEST-F07-1, TEST-F07-2 | Unit |
| AK-F07-2 | Gegeben ein Notfall, dann geht der Notfall-Alarm per SMS/E-Mail raus, wird bei Fehler schnell wiederholt, und der Betreiber wird alarmiert, wenn er nicht zugestellt wird | TEST-F07-3, TEST-F07-4, TEST-F07-5 | Unit, Integration, manuell |

### F-08 Rückruf-Vorgang
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F08-1 | Gegeben ein Gespräch, das ohne Vorgang endet (Auflegen, Fehler), dann entsteht ein Rückruf-Vorgang mit Teil-Transkript; Anrufe ohne Ende-Ereignis werden geschlossen | TEST-F08-1, TEST-F08-2 | Integration |

### F-09 Fallback und Ersatzziel
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F09-1 | Gegeben Pause, erschöpftes Kontingent, Kostenschutz oder KI-Störung, dann geht der Anruf an die Fallback-Nummer bzw. Mailbox | TEST-F09-1, TEST-F09-2 | Integration, manuell |
| AK-F09-2 | Gegeben der eigene Server ist aus, dann leitet das Ersatzziel bei Twilio weiter, ohne den Server aufzurufen; fehlt es, meldet die Überwachung das | TEST-F09-3, TEST-F09-4, TEST-F09-5 | Unit, Integration, manuell |

### F-10 Benachrichtigungen
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F10-1 | Gegeben eine Buchung am Telefon, dann antwortet der Server der KI, ohne auf E-Mail/SMS zu warten, und versendet danach; jede Nachricht wird protokolliert, auch ohne Versanddienst | TEST-F10-1, TEST-F10-2 | Integration |
| AK-F10-2 | Gegeben ein Versandfehler, dann wird mit Pause wiederholt und nach der Höchstzahl aufgegeben; nach „STOP“ geht keine SMS mehr an die Nummer | TEST-F10-3, TEST-F10-4 | Unit, Integration |

### F-11 Terminerinnerung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F11-1 | Gegeben Erinnerungen sind aktiv, dann bekommt der Kunde genau eine Erinnerung vor dem Termin, aber keine bei kurzfristig gebuchten Terminen | TEST-F11-1 | Integration |

### F-12 Portal-Startseite (Hub)
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F12-1 | Gegeben ein Kunden-Admin, dann zeigt die Startseite nur Vorgänge des eigenen Mandanten; Vorgang bearbeiten speichert Status und Notiz | TEST-F12-1, TEST-F12-2, TEST-F12-3 | E2E, HTTP |

### F-13 Anrufliste und Aufnahme
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F13-1 | Gegeben ein beendeter Anruf, dann zeigt die Anrufliste Zusammenfassung, Dauer, Status und spielt die Aufnahme mit Wellenform ab | TEST-F13-1, TEST-F13-2 | Unit, E2E |
| AK-F13-2 | Gegeben eine Aufnahme, dann wird sie nur über `/api/calls/[id]/recording` des eigenen Mandanten und nur von erlaubten HTTPS-Hosts ausgeliefert | TEST-F13-3, TEST-F13-4 | Unit, HTTP |

### F-14 Kundenverwaltung, DSGVO-Auskunft und -Löschung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F14-1 | Gegeben eine Auskunftsanfrage, dann enthält der Export nur Daten des eigenen Mandanten und verlangt eine frische Bestätigung | TEST-F14-1, TEST-F14-2 | Integration, HTTP |
| AK-F14-2 | Gegeben eine Löschanfrage, dann darf nur ein Kunden-Admin mit frischer Bestätigung löschen; Daten werden zuerst beim Anbieter gelöscht und danach nicht mehr ausgeliefert | TEST-F14-3 | HTTP, Integration |

### F-15 Team und Einsatzgebiete
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F15-1 | Gegeben Mitarbeiter mit PLZ-Gebieten und Rollen, dann routet der Server Privat-, Gewerbe- und Notfallanfragen an den passenden Mitarbeiter, verteilt Last und fällt außerhalb aller Gebiete zurück; nur Kunden-Admins pflegen das Team | TEST-F15-1, TEST-F15-2 | Unit, E2E |

### F-16 Einstellungen Unternehmen & KI
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F16-1 | Gegeben eigene Stichwörter/Kategorien, dann werden sie ergänzt; ungültige Einstellungen fallen auf Standardwerte zurück; Mitarbeiter können lesen, aber nicht ändern; Änderungen von fremder Herkunft werden blockiert | TEST-F16-1, TEST-F16-2 | Unit, HTTP |

### F-17 Integrationen Microsoft 365 / Google
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F17-1 | Gegeben ein Kunden-Admin mit Paket „Outlook-/Google-Kalender“, dann kann er verbinden; der Rücksprung gilt nur mit passender Sitzung und Nonce; Termine erscheinen im echten Kalender | TEST-F17-1, TEST-F17-2 | Integration, manuell |

### F-18 Konten und Zugang
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F18-1 | Gegeben ein Plattform-Admin, dann kommt er nur mit eingerichteter 2FA an Admin-Daten; TOTP entspricht RFC 6238 und ist nicht wiederverwendbar; falsches Passwort meldet nicht an | TEST-F18-1, TEST-F18-2, TEST-F18-3 | Unit, HTTP, E2E |
| AK-F18-2 | Gegeben eine sensible Aktion mit Bestätigung älter als 15 min, dann `403 REAUTH_REQUIRED`; Mitarbeiter verwalten keine Zugänge | TEST-F18-4 | HTTP |
| AK-F18-3 | Gegeben viele Fehlversuche, dann greifen Limits je Konto und IP gemeinsam für alle Instanzen; die Anmeldung verrät nicht, ob ein Konto existiert; geleakte Passwörter werden abgelehnt | TEST-F18-5, TEST-F18-6, TEST-F18-7 | Unit, Integration, HTTP |

### F-19 Aktivitäts- und Nachrichtenprotokoll
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F19-1 | Gegeben ein Kunden-Admin, dann sieht er das Aktivitätsprotokoll seines Mandanten (inkl. Support-Zugriff und abgespielter Aufnahmen); Mitarbeiter erhalten `403`; das Nachrichtenprotokoll zeigt keine Inhalte | TEST-F19-1 | HTTP |

### F-20 Tarif und Verbrauch
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F20-1 | Gegeben 80 % bzw. 100 % des Kontingents, dann wird der Kunde je Schwelle einmal gewarnt | TEST-F20-1 | Integration |

### F-21 Plattform-Verwaltung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F21-1 | Gegeben ein Plattform-Admin mit 2FA, dann sieht er alle Kunden in der Verwaltung | TEST-F21-1 | E2E, HTTP |
| AK-F21-2 | Gegeben „Portal öffnen“ oder ein Zugangslink für ein fremdes Konto, dann nur mit frischer Bestätigung und mit Eintrag im Kundenprotokoll | TEST-F21-2, TEST-F21-3 | HTTP |
| AK-F21-3 | Gegeben ein Mandant ohne AVV-Version und -Datum, dann kann er nicht auf ACTIVE gesetzt werden | TEST-F21-4 | Unit |

### F-22 Pakete mit serverseitigen Grenzen
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F22-1 | Gegeben ein Paket, dann setzt der Server Zugänge, Rufnummern und Funktionen durch, unabhängig von der Oberfläche | TEST-F22-1 | Integration |

### F-23 Abrechnung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F23-1 | Gegeben Gespräche eines Monats, dann rechnet der Server je Gespräch auf den Takt auf, nach Twilio-Dauer, mit Überminuten, SMS, Einrichtungsgebühr nur im ersten Monat und Monatsgrenzen in Ortszeit | TEST-F23-1, TEST-F23-2, TEST-F23-3 | Unit, Integration |

### F-24 Verbindungen und Plattform-Einstellungen
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F24-1 | Gegeben ein Anbieter-Schlüssel in der Oberfläche, dann wird er verschlüsselt gespeichert, nur maskiert angezeigt und nach einem Schlüsselwechsel umgeschlüsselt; `.env.example` nennt alle Variablen | TEST-F24-1, TEST-F24-2, TEST-F24-3, TEST-F24-4 | Unit, Integration |

### F-25 Kostenschutz
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F25-1 | Gegeben die Grenzen für gleichzeitige Anrufe, Tagesbudget und Höchstdauer, dann gehen weitere Anrufe an den Fallback und überlange Gespräche werden beendet; der Notschalter wirkt beim nächsten Anruf | TEST-F25-1 | Integration, Unit |
| AK-F25-2 | Gegeben viele Anrufe derselben bzw. einer unterdrückten Nummer in einer Stunde, dann gehen sie ab der Grenze an den Fallback; unter Last bleibt die Antwortzeit im Ziel aus `18-qualitaetsziele.md` | TEST-F25-2, TEST-F25-3 | Integration, Last |

### F-26 Überwachung und Alarme
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F26-1 | Gegeben nicht zugestellte Notfall-Alarme, hängende Anrufe oder fehlendes Backup, dann alarmiert die Überwachung ohne Wiederholungsflut; fällt der Server aus, meldet der externe Lebenszeichen-Dienst | TEST-F26-1, TEST-F26-2 | Integration, manuell |

### F-27 Löschfristen und Offboarding
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F27-1 | Gegeben ein Anruf älter als die Frist, dann wird er zuerst beim Anbieter (Retell/Twilio/Vapi/ElevenLabs) gelöscht und danach lokal geleert; das gilt auch für Anrufe ohne Anbieter-Ende | TEST-F27-1, TEST-F27-2 | Integration, manuell |
| AK-F27-2 | Gegeben eine Mandanten-Löschung, dann erst nach Anbieter-Löschung (oder ausdrücklich erzwungen), ohne andere Mandanten zu berühren | TEST-F27-3 | Integration |

### F-28 Verschlüsselte externe Backups
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F28-1 | Gegeben der tägliche Lauf, dann liegt ein age-verschlüsseltes Backup extern und lässt sich wiederherstellen; fehlt es, kommt ein Alarm | TEST-F28-1, TEST-F28-2 | Integration, manuell |

### F-29 Aufzeichnung mit Einwilligung (Variante C)
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F29-1 | Gegeben „ausdrücklich fragen“, dann fragt die KI, hält die Antwort mit Zeitpunkt fest und löscht ohne Zustimmung die Aufnahme beim Anbieter | TEST-F29-1, TEST-F29-2 | Integration, Unit |

### F-30 Echte Rechnungen und Zahlung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F30-1 | Gegeben ein Monatsabschluss, dann entsteht eine Rechnung mit fortlaufender Nummer; Freischaltung nur nach bestätigtem Zahlungs-Webhook | TEST-F30-1 | Integration |

### F-37 Agent-Einrichtung per API
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F37-1 | Gegeben `voice-agent/tools.json`, dann nutzt sie genau die Funktionen und Kundentypen des Servers und `identify_caller` nimmt keine Rufnummer an | TEST-F37-1 | Unit |

### F-39 Test-Kunde nur in der Testumgebung
| ID | Kriterium | Test | Ebene |
|---|---|---|---|
| AK-F39-1 | Gegeben Produktion, dann lässt sich kein Test-Kunde anlegen, auch nicht mit `DEMO_SEED=true` | TEST-F39-1 | Unit |

## Testliste (ID → konkreter Test)

Dateien: `tests/*.test.ts` (Unit), `tests/integration/tenancy.test.ts` (Integration mit Postgres, describe „Mandantentrennung & Sprach-Pipeline“), `tests/e2e/http.test.ts` (HTTP gegen echten Build, describe „HTTP: Zugriffsregeln und Schutzmechanismen“), `tests/e2e/ui.test.ts` (Browser, describe „E2E im Browser“).

| Test | Datei › Testname | Stand |
|---|---|---|
| TEST-F01-1 | `integration/tenancy.test.ts` › „ordnet Anrufe über die angerufene Nummer dem richtigen Mandanten zu“ | vorhanden |
| TEST-F01-2 | `providers.test.ts` › „wählt Anbieter: Nummer vor Kunde vor Standard“, „Vapi-SIP-Benutzer je Nummer und Rückweg“ | vorhanden |
| TEST-F01-3 | `docs/testanrufe.md` Szenarien 1–3 je Anbieter (Retell, Vapi, ElevenLabs) | manuell, offen |
| TEST-F01-4 | Vertragstests mit echten, anonymisierten Payloads je Anbieter (`tests/fixtures/<anbieter>/`); heute nur synthetisch: `payload.test.ts` › „parst Retell Custom Functions“, „parst Vapi tool-calls inkl. String-Argumenten“, „parst Retell call_analyzed“, „parst Vapi end-of-call-report“; `providers.test.ts` › „ElevenLabs-Webhook-Tool: Metadaten getrennt von Argumenten“, „ElevenLabs post_call_transcription“ | offen (synthetisch vorhanden) |
| TEST-F01-5 | `security.test.ts` › „entspricht dem dokumentierten Beispiel“, „validiert Requests mit gesetztem Token“, „lässt sich nur außerhalb der Produktion abschalten“ | vorhanden |
| TEST-F01-6 | `e2e/http.test.ts` › „T-SEC-HTTP-07: Webhooks und Cron ohne Geheimnis bzw. Signatur werden abgelehnt“ | vorhanden |
| TEST-F02-1 | `urgency.test.ts` › „ergänzt den KI-Hinweis bei eigener Begrüßung ohne Offenlegung“, „lässt eine Begrüßung mit Offenlegung unverändert (ohne Aufzeichnung)“, „fragt bei Variante C ausdrücklich nach der Aufzeichnung“ | vorhanden |
| TEST-F02-2 | `urgency.test.ts` › „nutzt den Agenten ohne Speicherung, wenn vorhanden“, „kündigt die Aufzeichnung an, wenn kein Agent ohne Speicherung existiert“, „behandelt eigene Agenten je Nummer als aufzeichnend“ | vorhanden |
| TEST-F02-3 | `docs/testanrufe.md` Szenario 1 je Anbieter | manuell, offen |
| TEST-F02-4 | `legal.test.ts` › „nennt die URL sprechbar ohne Protokoll“, „bietet ohne URL die Zusendung an“, „übernimmt keine ungültige URL“ | vorhanden |
| TEST-F03-1 | `integration/tenancy.test.ts` › „gibt Kundendaten nur zur verifizierten Anrufernummer heraus“ | vorhanden |
| TEST-F03-2 | `voice-auth.test.ts` › „identify_caller nimmt keine Rufnummer von der KI an“ | vorhanden |
| TEST-F03-3 | `integration/tenancy.test.ts` › „trennt Kundendaten strikt – gleiche Rufnummer, zwei Mandanten“ | vorhanden |
| TEST-F03-4 | `phone.test.ts` › „normalizePhone“ (inkl. „verwirft ungültige Eingaben“) | vorhanden |
| TEST-F03-5 | `docs/testanrufe.md` Szenarien 3, 4, 5, 6, 15 | manuell, offen |
| TEST-F04-1 | `integration/tenancy.test.ts` › „speichert Gewerbekunden auch mit dem alten Wert B2B_HACCP als BUSINESS“ | vorhanden |
| TEST-F04-2 | `voice-auth.test.ts` › „nutzt genau die Kundentypen, die der Server kennt“, „beschreibt genau die Funktionen, die der Server kennt“ | vorhanden |
| TEST-F04-3 | `urgency.test.ts` › „stuft Gewerbe bei Hygieneschädlingen hoch“, „übernimmt die höhere KI-Einschätzung“, „toleriert Füllwörter in Mehrwort-Stichwörtern“ | vorhanden |
| TEST-F04-4 | `integration/tenancy.test.ts` › „verhindert Doppelbuchungen und arbeitet idempotent je Anruf“ | vorhanden |
| TEST-F05-1 | `routing.test.ts` › „wählt die fachlich passende Rolle“, „routet Privatkunden auf den Gebietstechniker“; `postal.test.ts` › „matcht exakte PLZ, Präfixe, Bereiche und Wildcard“; `time.test.ts` › „findet freie Slots an Werktagen und umgeht belegte Zeiten“, „berücksichtigt Puffer und Arbeitstage“ | vorhanden |
| TEST-F05-2 | `time.test.ts` › „rechnet Berliner Wanduhrzeit korrekt (Sommer- & Winterzeit)“, „rechnet Wanduhrzeiten um das Ende der Sommerzeit am 25.10.2026 richtig“, „… um den Beginn der Sommerzeit am 29.03.2026 richtig“, „bietet über die Umstellung hinweg Termine zur richtigen Ortszeit an“, „beginnt Monate und Tage in Ortszeit (Abrechnung, Tagesgrenzen)“ | vorhanden |
| TEST-F05-3 | `integration/tenancy.test.ts` › „verhindert Doppelbuchungen und arbeitet idempotent je Anruf“ | vorhanden |
| TEST-F05-4 | `integration/tenancy.test.ts` › „ignoriert fremde Mitarbeiter-IDs aus den KI-Argumenten“ | vorhanden |
| TEST-F05-5 | `docs/testanrufe.md` Szenarien 2, 9, 10 mit Outlook- bzw. Google-Testkonto | manuell, offen |
| TEST-F06-1 | `integration/tenancy.test.ts` › „verschiebt und sagt Termine per Telefon ab – nur für die verifizierte Anrufernummer“ | vorhanden |
| TEST-F06-2 | Testanruf: Termin verschieben und absagen je Anbieter (in `docs/testanrufe.md` ergänzen) | manuell, offen |
| TEST-F07-1 | `urgency.test.ts` › „erkennt Notfälle“, „ignoriert verneinte Stichwörter“, „erkennt Gasgeruch und Wasserschäden“ | vorhanden |
| TEST-F07-2 | `routing.test.ts` › „routet Notfälle auf den Notdienst mit Durchstellung“ | vorhanden |
| TEST-F07-3 | `notify-retry.test.ts` › „wartet bei Notfall-Alarmen kürzer“ | vorhanden |
| TEST-F07-4 | `integration/tenancy.test.ts` › „alarmiert bei nicht versendeten Notfall-Alarmen, hängenden Anrufen und fehlendem Backup – ohne Wiederholungsflut“ | vorhanden |
| TEST-F07-5 | `docs/testanrufe.md` Szenarien 7, 8 | manuell, offen |
| TEST-F08-1 | `integration/tenancy.test.ts` › „hängt Transkripte an und legt bei Abbruch ein Rückruf-Ticket an“ | vorhanden |
| TEST-F08-2 | `integration/tenancy.test.ts` › „übernimmt Gesprächsende und Dauer von Twilio, schließt Anrufe ohne Anbieter-Ereignis und rechnet nach Twilio-Dauer ab“ | vorhanden |
| TEST-F09-1 | `integration/tenancy.test.ts` › „lässt nur begrenzt viele gleichzeitige Anrufe zur KI und hat einen Notschalter“, „stoppt neue KI-Anrufe beim Tagesbudget der Plattform“ | vorhanden |
| TEST-F09-2 | `docs/testanrufe.md` Szenarien 16, 17; automatischer Test für Pause und Minutenlimit (`minuteGate`) am Twilio-Endpunkt | manuell + offen |
| TEST-F09-3 | `twilio-fallback.test.ts` › „leitet auf die Fallback-Nummer weiter, ohne unseren Server aufzurufen“, „sagt ohne Fallback-Nummer eine Störung an und legt auf“ | vorhanden |
| TEST-F09-4 | `integration/tenancy.test.ts` › „erkennt Rufnummern ohne unabhängiges Ersatzziel bei Twilio“ | vorhanden |
| TEST-F09-5 | `docs/testanrufe.md` Szenario 18 (Server aus) | manuell, offen |
| TEST-F10-1 | `integration/tenancy.test.ts` › „lässt die Sprach-KI nicht auf den Versand warten und versendet danach“ | vorhanden |
| TEST-F10-2 | `integration/tenancy.test.ts` › „protokolliert Benachrichtigungen auch ohne Versanddienst“ | vorhanden |
| TEST-F10-3 | `notify-retry.test.ts` › „gibt nach der Höchstzahl an Versuchen auf“; `integration/tenancy.test.ts` › „wiederholt fehlgeschlagene SMS mit Pause und gibt nach der Höchstzahl auf“ | vorhanden |
| TEST-F10-4 | `integration/tenancy.test.ts` › „respektiert SMS-Abbestellung (STOP) und Einwilligung“ | vorhanden |
| TEST-F11-1 | `integration/tenancy.test.ts` › „erinnert Kunden einmal vor dem Termin, aber nicht bei kurzfristig gebuchten Terminen“ | vorhanden |
| TEST-F12-1 | `e2e/ui.test.ts` › „E2E-02: Kunden-Admin sieht nur eigene Vorgänge“ | vorhanden |
| TEST-F12-2 | `e2e/http.test.ts` › „T-SEC-HTTP-02: Vorgang eines fremden Mandanten → 404 (nicht 403)“ | vorhanden |
| TEST-F12-3 | E2E: Vorgang öffnen, Status und Notiz ändern, Benachrichtigung erneut senden | offen |
| TEST-F13-1 | `waveform.test.ts` › „liefert so viele Balken wie verlangt, normiert auf 0–1“, „nutzt den lautesten Kanal“, „kommt mit Stille und leeren Daten zurecht“, „Platzhalter ist je ID gleich und im gültigen Bereich“, „formatiert Zeiten“ | vorhanden |
| TEST-F13-2 | E2E: Anrufliste mit Zusammenfassung und Abspielen | offen |
| TEST-F13-3 | `rate-limit.test.ts` › „erlaubt nur HTTPS-Hosts der Anbieter“; `recording-fetch.test.ts` › „bricht bei Weiterleitung auf einen fremden Host ab“, „folgt Twilio → S3 und schickt die Zugangsdaten nur an Twilio“ | vorhanden |
| TEST-F13-4 | HTTP: Aufnahme eines fremden Mandanten → `404`, kein Abruf beim Anbieter | offen |
| TEST-F14-1 | `integration/tenancy.test.ts` › „exportiert nur Daten des eigenen Mandanten“ | vorhanden |
| TEST-F14-2 | HTTP: `GET /api/customers/[id]/export` ohne frische Bestätigung → `403 REAUTH_REQUIRED` | offen |
| TEST-F14-3 | Integration: `integration/tenancy.test.ts` › „schreibt Monate fest, bevor Anrufdaten verschwinden (GoBD), und anonymisiert statt zu löschen“ (Anonymisierung, Minuten bleiben abrechenbar). **Offen:** HTTP `DELETE /api/customers/[id]` als Mitarbeiter → `403`, als Admin ohne Re-Auth → `403`, mit Re-Auth → Anbieter-Löschung, danach `404` | teilweise (Integration vorhanden, HTTP offen) |
| TEST-F15-1 | `routing.test.ts` › „routet HACCP-Kunden auf den B2B-Spezialisten im Gebiet“, „fällt außerhalb aller Gebiete auf überregionale Rolle zurück“, „verteilt Last bei gleichwertigen Technikern“, „liefert null ohne Mitarbeiter“; `postal.test.ts` › „normalisiert PLZ aus Freitext“, „bewertet genauere Treffer höher“ | vorhanden |
| TEST-F15-2 | E2E: Mitarbeiter anlegen mit PLZ-Bereich, Mitarbeiter-Rolle darf nicht | offen |
| TEST-F16-1 | `urgency.test.ts` › „ergänzt eigene Stichwörter und Kategorien“, „fällt bei ungültigen Einstellungen auf Defaults zurück“ | vorhanden |
| TEST-F16-2 | `e2e/http.test.ts` › „T-SEC-HTTP-03: Mitarbeiter dürfen keine Einstellungen und Zugänge verwalten“, „T-SEC-HTTP-04: schreibende Anfragen von fremder Herkunft werden blockiert (CSRF)“ | vorhanden |
| TEST-F17-1 | `integration/tenancy.test.ts` › „setzt Paketgrenzen durch: Zugänge, Rufnummern und Funktionen“ (Paketprüfung); OAuth-Rücksprung mit falschem `state` → Fehler | teilweise (Rücksprung offen) |
| TEST-F17-2 | Microsoft-Test-Tenant und Google-Testkonto verbinden, Termin buchen, trennen | manuell, offen |
| TEST-F18-1 | `totp.test.ts` › „entspricht den RFC-Testvektoren (6 Stellen)“, „Base32 ist umkehrbar“, „akzeptiert ±1 Zeitschritt und verhindert Wiederverwendung“, „erzeugt eindeutige Wiederherstellungscodes“ | vorhanden |
| TEST-F18-2 | `e2e/http.test.ts` › „T-SEC-HTTP-05: Plattform-Admin ohne 2FA kommt nicht an Admin-Daten“; `e2e/ui.test.ts` › „E2E-01: Plattform-Admin meldet sich mit 2FA an und sieht alle Kunden“ | vorhanden |
| TEST-F18-3 | `e2e/ui.test.ts` › „E2E-03: falsches Passwort zeigt einen Fehler, keine Anmeldung“ | vorhanden |
| TEST-F18-4 | `e2e/http.test.ts` › „T-SEC-HTTP-06: Plattform-Admin mit 2FA; sensible Aktion verlangt frische Bestätigung“, „T-SEC-HTTP-14: Reset-/Einladungslink für Kollegen nur mit frischer Bestätigung (T-SEC-29)“, „T-SEC-HTTP-03 …“ | vorhanden |
| TEST-F18-5 | `rate-limit.test.ts` › „lässt bis zum Limit zu und nennt danach die Wartezeit“, „trennt Schlüssel“; `integration/tenancy.test.ts` › „zählt sicherheitsrelevante Limits gemeinsam in der Datenbank“ | vorhanden |
| TEST-F18-6 | `e2e/http.test.ts` › „T-SEC-HTTP-09: Anmeldung verrät nicht, ob ein Konto existiert“, „T-SEC-HTTP-13: „Passwort vergessen“ antwortet gleich, ob das Konto existiert oder nicht (T-SEC-09)“ | vorhanden |
| TEST-F18-7 | `pwned.test.ts` › „sendet nur das 5-stellige Präfix und erkennt Treffer“, „ignoriert Padding-Einträge mit Zähler 0“, „blockiert nicht, wenn der Dienst ausfällt“ | vorhanden |
| TEST-F19-1 | HTTP: `/api/audit` als Mitarbeiter → `403`, als Admin nur eigener Mandant; Abspielen einer Aufnahme erzeugt `call.recording_played` | offen |
| TEST-F20-1 | `integration/tenancy.test.ts` › „warnt Kunden einmalig bei 80 % und 100 % des Kontingents“ | vorhanden |
| TEST-F21-1 | `e2e/ui.test.ts` › „E2E-01: Plattform-Admin meldet sich mit 2FA an und sieht alle Kunden“ | vorhanden |
| TEST-F21-2 | `e2e/http.test.ts` › „T-SEC-HTTP-06 …“ (Zugangslink nur mit Re-Auth) | vorhanden |
| TEST-F21-3 | HTTP: `POST /api/admin/switch` ohne frische Bestätigung → `403`; mit → Audit `platform.enter_tenant` | offen |
| TEST-F21-4 | `legal.test.ts` › „verlangt Version und Datum“ | vorhanden |
| TEST-F22-1 | `integration/tenancy.test.ts` › „setzt Paketgrenzen durch: Zugänge, Rufnummern und Funktionen“ | vorhanden |
| TEST-F23-1 | `billing.test.ts` › „rundet je Gespräch auf den Abrechnungstakt“, „berechnet Überminuten und zusätzliche SMS“, „berechnet im Stopp-Modus keine Überminuten“, „Einrichtungsgebühr nur im ersten Monat, Sonderpreise je Kunde“, „ohne Paket: keine Kosten, alle Funktionen“ | vorhanden |
| TEST-F23-2 | `integration/tenancy.test.ts` › „übernimmt Gesprächsende und Dauer von Twilio, … rechnet nach Twilio-Dauer ab“, „schreibt Monate fest, bevor Anrufdaten verschwinden (GoBD), und anonymisiert statt zu löschen“ (Monatsabschluss `BillingSnapshot`, Commit `48e363a`) | vorhanden |
| TEST-F23-3 | `time.test.ts` › „beginnt Monate und Tage in Ortszeit (Abrechnung, Tagesgrenzen)“ | vorhanden |
| TEST-F24-1 | `secret-box.test.ts` › „verschlüsselt mit Schlüssel-ID und entschlüsselt wieder“, „liest nach dem Wechsel mit dem alten Schlüssel und markiert zum Umschlüsseln“, „liest das alte Format v1 (ohne Schlüssel-ID)“; `totp.test.ts` › „verschlüsselt und erkennt Manipulation“ | vorhanden |
| TEST-F24-2 | `providers.test.ts` › „Registry: Geheimnisse sind als geheim markiert, Datenbank-Schlüssel nicht einstellbar“ | vorhanden |
| TEST-F24-3 | `integration/tenancy.test.ts` › „verschlüsselt nach einem Schlüsselwechsel alle Geheimnisse neu“ | vorhanden |
| TEST-F24-4 | `env-example.test.ts` › „enthält alle Variablen aus Code und Einstellungen“ | vorhanden |
| TEST-F25-1 | `integration/tenancy.test.ts` › „lässt nur begrenzt viele gleichzeitige Anrufe zur KI und hat einen Notschalter“, „stoppt neue KI-Anrufe beim Tagesbudget der Plattform“, „beendet Gespräche über der Höchstdauer bei Twilio“; `twilio-fallback.test.ts` › „setzt timeLimit an der SIP-Weiterleitung“ | vorhanden |
| TEST-F25-2 | Lasttest der Plattform: `scripts/loadtest.ts` (je simuliertem Gespräch `identify_caller` → `save_customer` → `find_technician` → `book_appointment`) gegen den Produktions-Build, lokal am 2026-10-24: 10/30/60 gleichzeitige Gespräche ohne Fehler, p95 207/444/816 ms (Ziel < 1 s). Grenze: lokal, ohne echte Anbieter, ohne Netzlatenz. **Offen:** Latenz mit echten Anbietern (Szenario 19), Ereignisse bis 2 MB, Portal-Polling | teilweise (lokaler Lasttest vorhanden, echte Anbieter offen) |
| TEST-F25-3 | Integration: 11. Anruf derselben Nummer bzw. 31. unterdrückter Anruf je Stunde → Fallback (`callsPerCaller`, `anonymousCallsPerNumber`) | offen |
| TEST-F26-1 | `integration/tenancy.test.ts` › „alarmiert bei nicht versendeten Notfall-Alarmen, hängenden Anrufen und fehlendem Backup – ohne Wiederholungsflut“ | vorhanden |
| TEST-F26-2 | Externer Lebenszeichen-Dienst: App stoppen, Alarm kommt an (Datum ablegen) | manuell, offen |
| TEST-F27-1 | Integration: `runRetention` mit Frist 7 Tage → Anbieter-Löschung zuerst, dann lokal geleert, `providerPurgedAt` gesetzt; Anbieter-Fehler → lokale Daten bleiben bis zum nächsten Lauf | offen |
| TEST-F27-2 | `docs/testanrufe.md` Szenario 20 (Löschung beim Anbieter mit echtem Konto; Hinweis: Mindestfrist im Code 7 Tage, nicht 0) | manuell, offen |
| TEST-F27-3 | `integration/tenancy.test.ts` › „löscht einen Mandanten nur nach Anbieter-Löschung (oder ausdrücklich erzwungen) und lässt andere unberührt“ | vorhanden |
| TEST-F28-1 | `integration/tenancy.test.ts` › „alarmiert bei … fehlendem Backup …“ | vorhanden |
| TEST-F28-2 | `deploy/backup-once.sh` und `deploy/restore-test.sh` auf Produktion mit `ok=1`, Datum in `23-launch.md` | manuell, offen |
| TEST-F29-1 | `integration/tenancy.test.ts` › „hält die Einwilligung zur Aufzeichnung fest und löscht die Aufnahme ohne Einwilligung“ | vorhanden |
| TEST-F29-2 | `urgency.test.ts` › „fragt bei Variante C ausdrücklich nach der Aufzeichnung“ | vorhanden |
| TEST-F30-1 | Rechnungsnummernkreis, PDF, Zahlungs-Webhook mit Signatur | offen (Funktion fehlt) |
| TEST-F37-1 | `voice-auth.test.ts` › „nutzt genau die Kundentypen, die der Server kennt“, „beschreibt genau die Funktionen, die der Server kennt“, „identify_caller nimmt keine Rufnummer von der KI an“ | vorhanden |
| TEST-F39-1 | Unit: `demoAllowed()` ist in Produktion `false`, auch mit `DEMO_SEED=true` | offen |

Ohne Funktionsbezug, aber Teil der CI: `netlify-migrations.test.ts` › „enthalten jede Prisma-Migration unverändert“ (Testumgebung = Produktionsschema).

## Rückverfolgungsmatrix

Aufgaben stehen in `21-roadmap.md` (Spalte „Bezug“ der TASK-Tabelle).

| Funktion | Priorität | Kriterien | Tests | Aufgaben (Phase 21) |
|---|---|---|---|---|
| F-01 | Muss | AK-F01-1, AK-F01-2 | TEST-F01-1 bis TEST-F01-6 | siehe `21-roadmap.md` |
| F-02 | Muss | AK-F02-1, AK-F02-2 | TEST-F02-1 bis TEST-F02-4 | siehe `21-roadmap.md` |
| F-03 | Muss | AK-F03-1, AK-F03-2 | TEST-F03-1 bis TEST-F03-5 | siehe `21-roadmap.md` |
| F-04 | Muss | AK-F04-1 | TEST-F04-1 bis TEST-F04-4 | siehe `21-roadmap.md` |
| F-05 | Muss | AK-F05-1, AK-F05-2 | TEST-F05-1 bis TEST-F05-5 | siehe `21-roadmap.md` |
| F-06 | Sollte | AK-F06-1 | TEST-F06-1, TEST-F06-2 | siehe `21-roadmap.md` |
| F-07 | Muss | AK-F07-1, AK-F07-2 | TEST-F07-1 bis TEST-F07-5 | siehe `21-roadmap.md` |
| F-08 | Muss | AK-F08-1 | TEST-F08-1, TEST-F08-2 | siehe `21-roadmap.md` |
| F-09 | Muss | AK-F09-1, AK-F09-2 | TEST-F09-1 bis TEST-F09-5 | siehe `21-roadmap.md` |
| F-10 | Muss | AK-F10-1, AK-F10-2 | TEST-F10-1 bis TEST-F10-4 | siehe `21-roadmap.md` |
| F-11 | Sollte | AK-F11-1 | TEST-F11-1 | siehe `21-roadmap.md` |
| F-12 | Muss | AK-F12-1 | TEST-F12-1, TEST-F12-2, TEST-F12-3 | siehe `21-roadmap.md` |
| F-13 | Muss | AK-F13-1, AK-F13-2 | TEST-F13-1 bis TEST-F13-4 | siehe `21-roadmap.md` |
| F-14 | Muss | AK-F14-1, AK-F14-2 | TEST-F14-1, TEST-F14-2, TEST-F14-3 | siehe `21-roadmap.md` |
| F-15 | Muss | AK-F15-1 | TEST-F15-1, TEST-F15-2 | siehe `21-roadmap.md` |
| F-16 | Muss | AK-F16-1 | TEST-F16-1, TEST-F16-2 | siehe `21-roadmap.md` |
| F-17 | Sollte | AK-F17-1 | TEST-F17-1, TEST-F17-2 | siehe `21-roadmap.md` |
| F-18 | Muss | AK-F18-1, AK-F18-2, AK-F18-3 | TEST-F18-1 bis TEST-F18-7 | siehe `21-roadmap.md` |
| F-19 | Muss | AK-F19-1 | TEST-F19-1 | siehe `21-roadmap.md` |
| F-20 | Muss | AK-F20-1 | TEST-F20-1 | siehe `21-roadmap.md` |
| F-21 | Muss | AK-F21-1, AK-F21-2, AK-F21-3 | TEST-F21-1 bis TEST-F21-4 | siehe `21-roadmap.md` |
| F-22 | Muss | AK-F22-1 | TEST-F22-1 | siehe `21-roadmap.md` |
| F-23 | Muss | AK-F23-1 | TEST-F23-1, TEST-F23-2, TEST-F23-3 | siehe `21-roadmap.md` |
| F-24 | Muss | AK-F24-1 | TEST-F24-1 bis TEST-F24-4 | siehe `21-roadmap.md` |
| F-25 | Muss | AK-F25-1, AK-F25-2 | TEST-F25-1, TEST-F25-2, TEST-F25-3 | siehe `21-roadmap.md` |
| F-26 | Muss | AK-F26-1 | TEST-F26-1, TEST-F26-2 | siehe `21-roadmap.md` |
| F-27 | Muss | AK-F27-1, AK-F27-2 | TEST-F27-1, TEST-F27-2, TEST-F27-3 | siehe `21-roadmap.md` |
| F-28 | Muss | AK-F28-1 | TEST-F28-1, TEST-F28-2 | siehe `21-roadmap.md` |
| F-29 | Später | AK-F29-1 | TEST-F29-1, TEST-F29-2 | siehe `21-roadmap.md` |
| F-30 | Sollte | AK-F30-1 | TEST-F30-1 | siehe `21-roadmap.md` |
| F-37 | Sollte | AK-F37-1 | TEST-F37-1 | siehe `21-roadmap.md` |
| F-39 | Sollte | AK-F39-1 | TEST-F39-1 | siehe `21-roadmap.md` |

## Teststrategie

| Ebene | Werkzeug | Was | Wann |
|---|---|---|---|
| Unit | Vitest (`npm test`) | reine Logik: Zeit/Zeitzonen, Routing, PLZ, Dringlichkeit, Abrechnung, Signaturen, TOTP, Verschlüsselung, Payload-Parser, Konsistenz Agent-Tools ↔ Server | jeder Push, CI |
| Integration | Vitest + PostgreSQL (`tests/integration/tenancy.test.ts`, nur mit Test-DB) | Mandantentrennung, Sprach-Pipeline (Tools, Ereignisse), Kostenschutz, Benachrichtigungen, Löschung, Schlüsselwechsel | jeder Push, CI (Postgres-Dienst) |
| HTTP gegen echten Build | Vitest + `fetch` (`tests/e2e/http.test.ts` über `scripts/e2e.sh`, eigene Test-DB wird geleert) | Zugriffsregeln je Endpunkt, fremde Datensätze ändern/löschen, Rollen/Mandant im Body, Reset-Links, CSRF, 2FA-Pflicht, Re-Auth, Header, Webhooks ohne Ausweis, Enumeration (T-SEC-HTTP-01…14) | jeder Push, CI (seit `7404f55`, erweitert in `33c0708`) |
| Browser-E2E | Playwright + Vitest (`tests/e2e/ui.test.ts`) | Login mit 2FA, Mandantentrennung in der Oberfläche, Fehlermeldung | jeder Push, CI |
| Vertragstests | Vitest mit Fixtures `tests/fixtures/<anbieter>/` | echte, anonymisierte Payloads je Anbieter | **offen** (nach ersten Testanrufen) |
| Testanrufe | `docs/testanrufe.md` (20 Szenarien) | echte Gespräche je Anbieter, Missbrauchsfälle, Latenz, Ausfall, Löschung | vor Launch und nach jeder Änderung an Prompt, Tools oder Anbieter; **noch kein Durchlauf protokolliert** |
| Last / Latenz | `scripts/loadtest.ts` (`CALLS=…`, gegen Produktions-Build mit Test-DB, nie gegen Produktion) | Tool-Spitzen über den Funktionsaufruf-Pfad (lokal belegt, siehe unten); offen: Ereignisse bis 2 MB, Portal-Polling, Latenz mit echten Anbietern | vor jedem Launch bzw. größeren Änderungen am Tool-Pfad (TEST-F25-2) |
| Sicherheit statisch | gitleaks (CI), `npm audit --omit=dev --audit-level=high` (CI, seit `859b8e0`; Produktion ohne Befund), Build-Scan `scripts/scan-build.sh` mit Kanarienwerten (CI, seit `33c0708`), Dependabot | Geheimnisse im Repository und im Browser-Code, bekannte Schwachstellen | jeder Push |
| Barrierefreiheit | offen (axe/Lighthouse) | Kontraste, Beschriftungen, Tastatur | vor Launch (OP-19-08) |
| Lint / Typen | ESLint, `tsc` (CI) | – | jeder Push |

### Letzte Testläufe (Nachweis)

| Datum | Lauf | Ergebnis | Grenze |
|---|---|---|---|
| 2026-10-24 | Unit (`npm test`, `tests/*.test.ts`) lokal | 133 grün | – |
| 2026-10-24 | Integration (`tests/integration/tenancy.test.ts`) lokal mit Postgres | 31/31 grün | – |
| 2026-10-24 | E2E (`tests/e2e`: HTTP T-SEC-HTTP-01…14 und Browser E2E-01…03) lokal gegen Produktions-Build | 17/17 grün | lokal, nicht CI |
| 2026-10-24 | Lasttest `scripts/loadtest.ts` gegen Produktions-Build lokal, 10/30/60 gleichzeitige simulierte Gespräche (Tool-Aufrufe) | 0 Fehler; p95 207/444/816 ms (Ziel < 1 s) | lokal, ohne echte Anbieter, ohne Netzlatenz |

## Pflicht-Sicherheitstests

| ID | Test | Erwartung | Sichert ab |
|---|---|---|---|
| T-SEC-01 | `integration/tenancy.test.ts` › „trennt Kundendaten strikt – gleiche Rufnummer, zwei Mandanten“; `e2e/http.test.ts` › „T-SEC-HTTP-02: Vorgang eines fremden Mandanten → 404 (nicht 403)“. **Offen:** Kunde, Anruf, Aufnahme, Mitarbeiter, Benutzer per HTTP lesen | `404`, keine Daten | BD-07 |
| T-SEC-02 | `e2e/http.test.ts` › „T-SEC-HTTP-10: Ändern und Löschen fremder Datensätze → 404, Daten unverändert (T-SEC-02)“ (Vorgang ändern, Kunde ändern und löschen). **Offen:** Benutzer eines fremden Mandanten | `404`, Datensatz unverändert | BD-07 |
| T-SEC-03 | `integration/tenancy.test.ts` › „ignoriert fremde Mitarbeiter-IDs aus den KI-Argumenten“; `e2e/http.test.ts` › „T-SEC-HTTP-11: Rolle und Mandant lassen sich nicht über den Body setzen (T-SEC-03)“ | ignoriert bzw. `400` | BD-09 |
| T-SEC-04 | `integration/tenancy.test.ts` › „exportiert nur Daten des eigenen Mandanten“; `e2e/http.test.ts` › „T-SEC-HTTP-02 …“ (Startseite). **Offen:** `/api/calls`, `/api/customers`, `/api/messages` | nur eigener Mandant | BD-07 |
| T-SEC-05 | `rate-limit.test.ts` › „lässt bis zum Limit zu und nennt danach die Wartezeit“; `integration/tenancy.test.ts` › „zählt sicherheitsrelevante Limits gemeinsam in der Datenbank“ | `429` + `Retry-After`, gemeinsam für alle Instanzen | BD-08 |
| T-SEC-06 | `e2e/http.test.ts` › „T-SEC-HTTP-12: Reset-Link gilt einmal und nicht nach Ablauf; Reset beendet alle Sitzungen (T-SEC-06)“ | abgelehnt (`410`), alle Sitzungen beendet | BD-08 |
| T-SEC-07 | `integration/tenancy.test.ts` › „lässt nur begrenzt viele gleichzeitige Anrufe zur KI und hat einen Notschalter“, „stoppt neue KI-Anrufe beim Tagesbudget der Plattform“, „beendet Gespräche über der Höchstdauer bei Twilio“, „warnt Kunden einmalig bei 80 % und 100 % des Kontingents“ | Fallback statt KI, Gespräch beendet, Warnung | BD-03, BD-04 |
| T-SEC-08 | `e2e/http.test.ts` › „T-SEC-HTTP-01: ohne Anmeldung kein API-Zugriff, Seiten leiten zum Login“ | `401` bzw. Weiterleitung zum Login | BD-07, BD-08 |
| T-SEC-09 | `e2e/http.test.ts` › „T-SEC-HTTP-09: Anmeldung verrät nicht, ob ein Konto existiert“, „T-SEC-HTTP-13: „Passwort vergessen“ antwortet gleich, ob das Konto existiert oder nicht (T-SEC-09)“ | identische Antwort | BD-08 |
| T-SEC-10 | `rate-limit.test.ts` › „erlaubt nur HTTPS-Hosts der Anbieter“; `recording-fetch.test.ts` › „bricht bei Weiterleitung auf einen fremden Host ab“, „folgt Twilio → S3 und schickt die Zugangsdaten nur an Twilio“. **Offen:** fremde Aufnahme per HTTP | kein Abruf, `404` | BD-13, BD-07 |
| T-SEC-11 | **offen:** `<script>`, 100 000 Zeichen, SQL-Fragmente in Transkript, Notiz, Name; Anzeige im Portal und in E-Mails | escaped bzw. `400` | BD-14 |
| T-SEC-12 | `e2e/http.test.ts` › „T-SEC-HTTP-08: Sicherheits-Header sind gesetzt“ | CSP mit `frame-ancestors 'none'`, `nosniff`, Referrer-Policy | BD-14 |
| T-SEC-13 | CI-Job „secrets“: gitleaks über das Repository; CI-Schritt „Build-Scan auf Geheimnisse im Browser-Code“ (`scripts/scan-build.sh`: Schlüsselmuster und Kanarienwerte in `.next/static`, Build mit `BUILD_CANARY`) | keine Treffer | BD-10 |
| T-SEC-14 | `e2e/http.test.ts` › „T-SEC-HTTP-03: Mitarbeiter dürfen keine Einstellungen und Zugänge verwalten“ | `403` | BD-09 |
| T-SEC-15 | `integration/tenancy.test.ts` › „löscht einen Mandanten nur nach Anbieter-Löschung (oder ausdrücklich erzwungen) und lässt andere unberührt“ (inkl. Schlussabrechnung), „schreibt Monate fest, bevor Anrufdaten verschwinden (GoBD), und anonymisiert statt zu löschen“. **Offen:** DSGVO-Löschung eines Kunden per HTTP mit Anbieter-Löschung (TEST-F14-3), Löschfrist (TEST-F27-1) | danach keine personenbezogenen Daten, Anbieter zuerst, Abrechnung bleibt | BD-16 |
| T-SEC-16 | `integration/tenancy.test.ts` › „setzt Paketgrenzen durch: Zugänge, Rufnummern und Funktionen“ | keine Freischaltung ohne Paket | BD-09 |
| T-SEC-17 | `integration/tenancy.test.ts` › „gibt Kundendaten nur zur verifizierten Anrufernummer heraus“, „verschiebt und sagt Termine per Telefon ab – nur für die verifizierte Anrufernummer“; `voice-auth.test.ts` › „identify_caller nimmt keine Rufnummer von der KI an“ | keine Daten Dritter | BD-01, BD-02 |
| T-SEC-18 | `integration/tenancy.test.ts` › „bindet ElevenLabs-/SIP-Funktionen fest an einen laufenden Anruf“, „lehnt Funktionsaufrufe im Format eines anderen Anbieters ab“; `voice-auth.test.ts` › „gilt bis kurz nach dem Auflegen und höchstens 3 Stunden“; `integration/tenancy.test.ts` › „vertraut bei Retell/Vapi ohne eigene Anrufzeile nicht der Anrufernummer aus dem Body“ | abgelehnt bzw. ohne Mandant bzw. ohne verifizierte Anrufernummer | BD-05 |
| T-SEC-19 | `voice-auth.test.ts` › „erkennt den Anbieter am eigenen Geheimnis“, „nimmt das gemeinsame Geheimnis nur, solange kein Anbieter-Geheimnis gesetzt ist“, „akzeptiert die Retell-Signatur als Retell“, „ist ohne Geheimnis nur außerhalb der Produktion offen“, „erlaubt jedem Anbieter nur sein eigenes Format“; `security.test.ts` › „prüft v=timestamp,d=digest“, „lässt sich nur außerhalb der Produktion abschalten“; `providers.test.ts` › „prüft die ElevenLabs-Signatur“; `e2e/http.test.ts` › „T-SEC-HTTP-07 …“; Retell-Altformat ohne Zeitstempel wird in „prüft v=timestamp,d=digest“ abgelehnt (Commit `0e0efc5`) | `401`/`403` ohne gültigen Ausweis | BD-05 |
| T-SEC-20 | `integration/tenancy.test.ts` › „ignoriert fremde Mitarbeiter-IDs aus den KI-Argumenten“, „speichert Gewerbekunden auch mit dem alten Wert B2B_HACCP als BUSINESS“ | KI-Argumente können keine fremden Daten adressieren | BD-01 |
| T-SEC-21 | `e2e/http.test.ts` › „T-SEC-HTTP-06: Plattform-Admin mit 2FA; sensible Aktion verlangt frische Bestätigung“, „T-SEC-HTTP-14: Reset-/Einladungslink für Kollegen nur mit frischer Bestätigung (T-SEC-29)“. **Offen:** Mandantenwechsel, Export, DSGVO-Löschung, Rollenänderung | `403 REAUTH_REQUIRED` | BD-12 |
| T-SEC-22 | `e2e/http.test.ts` › „T-SEC-HTTP-05: Plattform-Admin ohne 2FA kommt nicht an Admin-Daten“; `totp.test.ts` › „akzeptiert ±1 Zeitschritt und verhindert Wiederverwendung“ | `403 MFA_SETUP_REQUIRED`; Code nicht wiederverwendbar | BD-08, BD-12 |
| T-SEC-23 | **manuell:** `docs/testanrufe.md` Szenario 13 (Prompt-Injection) je Anbieter | bleibt in der Rolle, keine Daten | BD-01 |
| T-SEC-24 | `integration/tenancy.test.ts` › „sendet keine SMS in nicht freigegebene Länder (SMS-Pumping)“ (`SMS_ALLOWED_PREFIXES`, Commit `0e0efc5`). **Offen:** `transfer_call` nur an Server-Nummer (Anbieter-Konfiguration) | keine Kosten durch fremde Ziele | BD-03 |
| T-SEC-25 | `integration/tenancy.test.ts` › „alarmiert bei … fehlendem Backup …“. **Manuell:** Restore-Test mit Datum, Bucket enthält nur `.age`-Dateien | Backup verschlüsselt und wiederherstellbar | BD-11 |
| T-SEC-26 | `secret-box.test.ts` (alle drei Tests), `providers.test.ts` › „Registry: Geheimnisse sind als geheim markiert, Datenbank-Schlüssel nicht einstellbar“, `integration/tenancy.test.ts` › „verschlüsselt nach einem Schlüsselwechsel alle Geheimnisse neu“ | Geheimnisse nie im Klartext in der DB | BD-10 |
| T-SEC-28 | `e2e/http.test.ts` › „T-SEC-HTTP-04: schreibende Anfragen von fremder Herkunft werden blockiert (CSRF)“ | `403` | BD-15 |
| T-SEC-29 | `e2e/http.test.ts` › „T-SEC-HTTP-14: Reset-/Einladungslink für Kollegen nur mit frischer Bestätigung (T-SEC-29)“ | `403 REAUTH_REQUIRED`, Link nicht angezeigt | BD-09 |
| T-SEC-30 | **manuell:** Testanruf von bekannter Nummer – KI liest die Adresse nicht vor, sondern erfragt sie | keine Preisgabe bei gefälschter Nummer | BD-06 |
| T-SEC-31 | `twilio-fallback.test.ts` › „leitet auf die Fallback-Nummer weiter, ohne unseren Server aufzurufen“; `integration/tenancy.test.ts` › „erkennt Rufnummern ohne unabhängiges Ersatzziel bei Twilio“. **Manuell:** Szenario 18 | Anrufe kommen auch bei Serverausfall an | BD-17 |
| T-SEC-32 | **offen:** Einstellung „keine Zusammenfassung in Kalender/E-Mail“ – Inhalt prüfen | keine Freitext-Zusammenfassung bei Dritten | BD-19 |
| T-SEC-33 | `urgency.test.ts` › „Keine stille Aufzeichnung“ (drei Tests), „fragt bei Variante C ausdrücklich nach der Aufzeichnung“; `integration/tenancy.test.ts` › „hält die Einwilligung zur Aufzeichnung fest und löscht die Aufnahme ohne Einwilligung“ | nie Aufzeichnung ohne Hinweis bzw. Einwilligung | BD-20 |

**Gegenprobe-Lauf (eingeplant, noch nicht durchgeführt):** Für T-SEC-01, -08, -14, -17, -18, -19, -21, -22, -28 einmal lokal den Schutz entfernen (z. B. `tenantId` aus der Abfrage, `requireRecentAuth`, Origin-Prüfung, Prüfung `activeOnly`) und zeigen, dass der Test rot wird. Ergebnis mit Datum und Commit in `pruefungen/gegenprobe-<datum>.md`.

## Fehlende Tests (offen)

| Bereich | Was fehlt | Bezug |
|---|---|---|
| HTTP je Endpunkt | Fremder Mandant für Kunde, Anruf, Aufnahme, Mitarbeiter, Benutzer lesen; fremden Benutzer ändern; Listen `/api/calls`, `/api/customers`, `/api/messages`; Mitarbeiter auf DSGVO-Löschung, Audit, Export, Integrationen; Re-Auth für Export, Löschung, Rollen, Mandantenwechsel; Limit „Benachrichtigung erneut senden“ (5 je Vorgang/24 h) | T-SEC-01, -02, -04, -14, -21, TEST-F14-2, TEST-F14-3, TEST-F19-1, TEST-F21-3 |
| Telefon-KI | `transfer_call` nur an Server-Nummern (Anbieter-Konfiguration prüfen); Kalender-/E-Mail-Inhalte ohne Freitext-Zusammenfassung | T-SEC-24, T-SEC-32 |
| Vertragstests | echte Payloads je Anbieter als Fixtures | TEST-F01-4 |
| E2E | Vorgang bearbeiten, Anruf ansehen und abspielen, Mitarbeiter anlegen, Einstellungen speichern, DSGVO-Export und -Löschung, Offboarding eines Mandanten | TEST-F12-3, TEST-F13-2, TEST-F15-2 |
| Fachlogik | Löschfrist (`runRetention`), Anrufer-Limits am Twilio-Endpunkt, Pause/Minutenlimit-Fallback, Test-Kunde in Produktion gesperrt, OAuth-Rücksprung mit falschem `state` | TEST-F27-1, TEST-F25-3, TEST-F09-2, TEST-F39-1, TEST-F17-1 |
| Eingaben | XSS/Überlänge/SQL-Fragmente | T-SEC-11 |
| Last/Latenz | echte Anbieter (Szenario 19), Ereignisse bis 2 MB, Portal-Polling, Lauf auf dem Produktions-VPS statt lokal | TEST-F25-2 |
| Manuell | alle 20 Testanruf-Szenarien je Anbieter, Restore auf Produktion, externer Lebenszeichen-Alarm | TEST-F01-3, TEST-F26-2, TEST-F28-2, T-SEC-23, T-SEC-30 |
| Barrierefreiheit | axe/Lighthouse in der CI | OP-19-08 |

## Manuelle Release-Checkliste

Ausführlich in `docs/release-checkliste.md` (Agent C). Mindestens:
- [ ] CI grün (Lint, Typen, Unit, Integration, HTTP, Browser, `npm audit`, gitleaks, Docker-Build) – Lauf-Nummer notieren
- [ ] Bei Änderung an Prompt, Tools oder Anbieter: Testanruf-Szenarien 1–12 mit dem betroffenen Anbieter, Ergebnis in `docs/testanrufe.md`
- [ ] Backup vor dem Update (`deploy/backup-once.sh`), Migrationen geprüft
- [ ] Nach dem Update: `/api/health`, ein Testanruf, Startseite eines Test-Mandanten, Überwachung ohne neue Alarme
- [ ] `voice-agent/tools.json` und Prompt beim Anbieter mit dem Repository abgeglichen

## Beta-Test

Soft Launch mit 1–2 Pilotbetrieben (offene Entscheidung E-020): eigene Twilio-Nummer je Pilot, Rufumleitung zunächst nur „bei Nichtannahme“, Rückweg über die bisherige Rufumleitung. Wöchentlich prüfen: Abschlussquote der Gespräche, Anteil Rückruf-Vorgänge, falsch eingestufte Dringlichkeit, Beschwerden, Kosten je Minute. Abbruchkriterium: ein verlorener Notfall oder eine Datenpanne → KI-Notschalter an, Ursachenanalyse.

## Definition of Done (pro Aufgabe)

- Akzeptanzkriterium der Funktion erfüllt und als Test im Repository (oder als manueller Testanruf mit Datum) nachgewiesen
- Bei Sicherheitsbezug: zugehöriger `T-SEC` grün und einmal per Gegenprobe rot gesehen
- Neue Endpunkte: Rechteprüfung laut `12-berechtigungen.md` und HTTP-Test
- Neue KI-Funktion: Mandant und Anrufernummer nur aus der Anrufzeile, zod-Schema, Eintrag in `voice-agent/tools.json`, Konsistenztest grün
- Keine Geheimnisse im Code, `.env.example` aktuell (`env-example.test.ts`)
- Dokumentation (`11`–`15`, `docs/sicherheit.md`) angepasst, wenn sich Daten, Rechte oder Schnittstellen ändern
