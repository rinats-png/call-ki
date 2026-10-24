# Support-Playbook – KI-Telefonzentrale

> Nach `idea-to-app/templates/support-playbook.md`, angepasst an eine B2B-Plattform mit Auftragsverarbeitung. Stand: 2026-10-24. Schließt OP-20-08 (Support-Teil) und den Support-Teil von OP-20-06. Werte mit **(Vorschlag)** sind Empfehlungen, bis der Betreiber sie bestätigt; sie müssen mit dem SLA in `docs/recht/agb-sla-eckpunkte.md` übereinstimmen **[PRÜFEN]**.

## 0. Wer fragt uns – und wofür sind wir zuständig?

| Wer | Beziehung | Unsere Rolle |
|---|---|---|
| **Kunde** (Unternehmen): Kunden-Admin, Kunden-Mitarbeiter | Vertragspartner | Support für Portal, Telefon-KI, Abrechnung. Für Konto- und Vertragsdaten sind wir **Verantwortlicher**. |
| **Anrufer** der Kunden (Endkunden, Interessenten) | kein Vertrag mit uns | Wir sind **Auftragsverarbeiter** des Kunden. Fragen zu Daten, Terminen oder Inhalten leiten wir **an den Kunden** weiter und antworten nicht in der Sache (AVV § 6, `docs/recht/loeschkonzept.md` Abschnitt 3). |
| Anbieter, Behörden, Sicherheitsforscher | – | Eskalation (Abschnitt 6) |

## 1. Grundregeln (immer)

1. **Niemals nach Passwörtern, 2FA- oder Wiederherstellungscodes fragen** – auch nicht „zur Prüfung“. Steht auf der Hilfeseite und in jeder Einladungs-E-Mail.
2. **Identität prüfen**, bevor Kontodaten herausgegeben oder geändert werden (Abschnitt 5).
3. **Kein Blick in Mandantendaten ohne Anlass.** Zugriff nur über „Portal öffnen“ (Mandantenwechsel), nur wenn für den konkreten Fall nötig; jeder Wechsel steht im Audit-Log und ist für den Kunden sichtbar (Einstellungen → Aktivität). Grund und Ticket-Nummer im Ticket vermerken.
4. **Keine Inhalte aus Gesprächen** (Transkripte, Aufnahmen, Gesundheitsangaben) in Tickets, E-Mails, Chats oder KI-Werkzeuge kopieren – nur Kennungen (Anruf-ID, Vorgang-ID, Uhrzeit, letzte 3 Ziffern der Nummer).
5. Schickt ein Kunde sensible Daten von sich aus (Passwort, Transkript-Auszug, Gesundheitsdaten): nicht weiterverarbeiten, aus dem Postfach entfernen, freundlich darauf hinweisen.
6. **Ehrlich antworten**, nichts versprechen, was die Plattform nicht kann (z. B. keine Notrufannahme, siehe AGB-Ausschlüsse).
7. **Eskalieren statt raten** bei Sicherheit, Datenschutz, Geld und allem, was die **Notfall-Weiterleitung** betrifft.

## 2. Support-Kanäle

| Kanal | Nutzen wir? | Anmerkung |
|---|---|---|
| E-Mail `support@<domain>` (eigenes Postfach, 2FA) | ja | Hauptkanal, auch für Datenschutzanfragen |
| Störungs-Telefon für Kunden (Bereitschaftsnummer) | ja, nur für Störungen der Anrufannahme/Notfall-Weiterleitung **(Vorschlag)** | Nummer nur in Vertragsunterlagen, nicht öffentlich; Rückruf statt Sofortannahme zulässig |
| Hilfe-Seite (FAQ, Einrichtung der Rufumleitung) | ja | im Portal verlinkt |
| `security@<domain>` bzw. `/.well-known/security.txt` | ja | Meldungen von Sicherheitslücken **[PRÜFEN: Format security.txt]** |
| Ticket-System / Helpdesk-Dienst | nein (Start) | erst mit AVV, Eintrag in VVT und Unterauftragsverarbeiter-Liste |
| Chat, soziale Medien | nein | – |

**Datenschutz-Check:** ☐ Support-Postfach im VVT (A3 Kunden- und Vertragsverwaltung) · ☐ Postfach mit 2FA (`docs/betreiber-konten.md`) · ☐ Aufbewahrung Support-Korrespondenz: 2 Jahre nach Abschluss, Handelsbriefe länger (siehe `docs/recht/loeschkonzept.md`) **[PRÜFEN]** · ☐ Impressum nennt dieselbe Adresse.

**Support-Adresse:** `support@<domain>` · **Zuständig:** `<Name>` · **Vertretung:** `<Name>`

## 3. Antwortzeiten (Zusage des Betreibers)

Das Produkt verspricht, dass **Notfälle der Anrufer** den Bereitschaftsdienst des Kunden erreichen. Deshalb ist eine Störung der Anrufannahme bzw. der Notfall-Weiterleitung ein eigener, schneller Fall. Die Weiterleitung selbst hängt **nicht** an unserer Reaktionszeit: Fällt der Server aus, verbindet Twilio über das Ersatzziel direkt auf die Fallback-Nummer des Kunden (`docs/betrieb.md`). Unsere Reaktionszeit betrifft das Beheben und Informieren.

| Art der Anfrage | Erste Antwort bis **(Vorschlag)** | Lösung angestrebt | Wer |
|---|---|---|---|
| **S1 – Anrufannahme oder Notfall-Weiterleitung gestört** (keine Anrufe, Notfall-Alarm nicht zugestellt, kritischer Alarm der Überwachung) | **30 Min.** Mo–Fr 07–20 Uhr, **2 Std.** außerhalb, auch Wochenende/Feiertag (Rufbereitschaft) | Umgehung (Fallback, Notschalter) sofort; Ursache innerhalb 1 Werktag | Bereitschaft laut Dienstplan, sonst Inhaber |
| S2 – Teilfunktion gestört (Kalender, E-Mail, SMS, Portal langsam) | 4 Std. werktags | 1–2 Werktage | Technik |
| Allgemeine Frage, Einrichtung | 1 Werktag | – | Support |
| Abrechnung / Zahlung | 2 Werktage | 5 Werktage | Inhaber |
| Datenschutzanfrage (Auskunft, Löschung, Export) eines Portal-Nutzers | Eingangsbestätigung 2 Werktage | gesetzliche Frist beachten (siehe `guides/recht-eu-ueberblick.md`) **[PRÜFEN]** | Datenschutz |
| Anfrage eines **Anrufers** | Weiterleitung an den Kunden innerhalb 1 Werktag | – (Kunde entscheidet) | Support |
| Verdacht auf Sicherheitslücke / Datenpanne | **sofort** an Incident-Leitung | `docs/recht/incident-plan.md` (Kundeninformation spätestens 24 h, AVV § 6) | Incident-Leitung |
| Funktionswunsch | 5 Werktage | – | Inhaber |

**Bereitschaft (OP-20-06, offen):** Dienstplan mit Vertretung, Erreichbarkeit per Alarm-SMS (`ALERT_SMS`) und externem Lebenszeichen-Dienst, Urlaubsvertretung. Solange nur eine Person den Betrieb macht, darf das SLA keine 24/7-Reaktion versprechen – dann „2 Std. außerhalb der Geschäftszeiten nach bestem Bemühen“ formulieren **[PRÜFEN]**.

**Abwesenheitsnotiz:** Hinweis auf die Hilfeseite, die Störungsnummer für S1 und `security@`.

## 4. Standardantworten

> Platzhalter in spitzen Klammern ersetzen. Keine Inhaltsdaten in die Antwort kopieren.

### 4.1 Kunde kündigt / möchte seine Daten löschen
„Guten Tag <Name>, vielen Dank für Ihre Nachricht. Vor dem Vertragsende können Sie unter Einstellungen → Datenschutz einen Gesamtexport herunterladen. Spätestens 30 Tage nach Vertragsende löschen wir alle Daten Ihres Unternehmens, auch bei unseren Telefonie- und KI-Dienstleistern; Datensicherungen laufen danach innerhalb von 30 Tagen aus. Rechnungen bewahren wir aufgrund gesetzlicher Pflichten auf; sie enthalten keine Gesprächsinhalte. Bitte bestätigen Sie die Kündigung über das Portal bzw. von Ihrer hinterlegten Admin-Adresse.“
(Ablauf: `docs/recht/loeschkonzept.md`, Mandant löschen; Backup-Frist dort prüfen.)

### 4.2 Datenauskunft / Export
- **Portal-Nutzer** (eigene Kontodaten): Bestätigungslink an die hinterlegte Adresse senden, dann Auskunft zu Name, E-Mail, Rolle, Sitzungen, Protokolleinträgen.
- **Anrufer** fragt bei uns: „Guten Tag, Ihre Daten verarbeiten wir im Auftrag von <Firma>. Wir haben Ihre Anfrage heute an <Firma> weitergeleitet, die Ihnen direkt antwortet.“ → An den Kunden: „Ein Anrufer bittet um <Auskunft/Löschung>. Sie können das im Portal unter Kunden → Datensatz → Export bzw. Löschen erledigen (löscht auch beim Anbieter).“

### 4.3 „Die KI nimmt nicht ab“ / „Anrufe kommen nicht an“
„Danke für die schnelle Meldung. Wir prüfen sofort. Bis dahin werden Anrufe auf Ihre hinterlegte Fallback-Nummer <…> weitergeleitet. Bitte nennen Sie uns Uhrzeit und die letzten drei Ziffern der anrufenden Nummer, damit wir den Anruf finden.“ → intern S1: Überwachung, `docker compose ps`, Twilio-Anrufliste, Status des KI-Anbieters, ggf. Notschalter.

### 4.4 Rechnung / Verbrauch unklar
„Ihre Minuten sehen Sie im Portal unter <Bereich>. Abgerechnet wird je Gespräch auf die angefangene Minute, Grundlage ist die Gesprächsdauer laut unserem Telefonie-Anbieter. Wir schicken Ihnen gern eine Aufstellung je Tag.“ Keine Gutschrift ohne Rücksprache mit dem Inhaber.

### 4.5 Missbrauch (Spam-Anrufe, Massenanrufe, fremde Nutzung)
„Danke für den Hinweis. Wir begrenzen Anrufe je Rufnummer und Stunde bereits automatisch und prüfen den Fall.“ → Nummer sperren bzw. Limit senken, bei Kosten- oder Betrugsverdacht Notschalter für den Mandanten, Eintrag im Vorfallprotokoll.

### 4.6 Anmeldung / 2FA-Gerät verloren
„Bitte nutzen Sie einen Ihrer Wiederherstellungscodes. Haben Sie keinen mehr, kann Ihr Kunden-Admin Ihren Zugang zurücksetzen. Wir fragen Sie nie nach Passwort oder Codes.“ Plattform-Admin ohne Codes: nur nach Abschnitt 5, Zeile „Zugang verloren“.

### 4.7 Eingangsbestätigung
„Vielen Dank, wir haben Ihre Anfrage erhalten (Nr. <…>) und melden uns bis <Zeit laut Abschnitt 3>.“

### 4.8 Nicht umsetzbarer Wunsch (z. B. Notrufannahme, Ausgehende Werbeanrufe)
„Das bieten wir bewusst nicht an: <Grund, z. B. kein Notrufdienst laut AGB>. Eine mögliche Alternative ist <…>.“

## 5. Identität prüfen

| Aktion | Mindestprüfung |
|---|---|
| Allgemeine Frage | keine |
| Auskunft zu Paket, Verbrauch, Einstellungen eines Mandanten | Anfrage von einer im Mandanten **hinterlegten Admin-Adresse** |
| Änderung von Fallback-Nummer, Notfallkontakten, Rufnummer, Admin-Adresse; Export; Mandant löschen | Kunde erledigt es selbst im Portal (Re-Auth). Muss der Betreiber handeln: **Bestätigungslink bzw. Rückruf über die im Vertrag hinterlegte Nummer**, nie allein auf eine eingehende E-Mail oder einen Anruf hin |
| Datenauskunft eines Portal-Nutzers | Bestätigungslink an die hinterlegte Adresse |
| Anfrage eines Anrufers | **keine Prüfung durch uns** – wir geben nichts heraus, sondern leiten an den Kunden weiter |
| Zugang des Kunden-Admins verloren, Adresse nicht mehr erreichbar | schriftliche Anfrage der Geschäftsführung auf Briefpapier/aus der Vertragskorrespondenz + Rückruf über die Vertragsnummer; im Zweifel ablehnen |
| Behörden, Anwälte, „im Auftrag“ | schriftlich, Rechtsgrundlage prüfen, Fachperson; bei Anruferdaten zuerst den Kunden informieren, soweit zulässig |

**Warnzeichen:** Eile, andere Absenderadresse, Wunsch nach Änderung der Fallback- oder Notfallnummer „sofort“ (Umleitung von Kundenanrufen auf fremde Nummern), Kombination „Admin-Adresse ändern + Passwort zurücksetzen“. Dann nicht handeln, über den bekannten Weg zurückfragen.

**Dokumentation:** im Ticket, wie geprüft wurde und wer entschieden hat – ohne Ausweisdaten zu speichern.

## 6. Eskalation

| Situation | Sofort an | Dokument |
|---|---|---|
| Kunde sieht **fremde Daten**, Verdacht auf Hack/Datenleck, Schlüssel öffentlich | Incident-Leitung (S1) | `docs/recht/incident-plan.md` |
| Notfall-Alarm nicht zugestellt, Anrufannahme gestört | Bereitschaft (S1) | `docs/betrieb.md` → Überwachung |
| Mehrere gleichartige Fehlermeldungen | Technik | `docs/betrieb.md` |
| Anfrage nach Auskunft/Löschung eines Portal-Nutzers | Datenschutz (Frist läuft ab Eingang) | `guides/recht-eu-ueberblick.md` |
| Anfrage eines Anrufers | an den Kunden weiterleiten | AVV § 6 |
| Beschwerde, Drohung mit Behörde/Anwalt | Datenschutz/Recht | – |
| Kostenauffälligkeit (Alarm „Ungewöhnlich hoher Verbrauch“, Tagesbudget) | Inhaber | `docs/idea-to-app/17-kosten.md` |
| Sicherheitsmeldung von Außenstehenden | Technik + Incident-Leitung; Eingang bestätigen, nichts leugnen | `docs/recht/incident-plan.md` |
| Kulanz, Vertragsänderung | Inhaber | – |

## 7. Störungskommunikation

Lösung für den Start: **E-Mail an die Kunden-Admins der betroffenen Mandanten** und ein Hinweis auf der Hilfeseite; eine getrennt gehostete Statusseite ist offen (OP-20-14).

- **Störung beginnt:** „Seit <Uhrzeit> ist <Funktion> gestört. Anrufe werden auf Ihre Fallback-Nummer weitergeleitet / Notfall-Alarme kommen per <Kanal>. Nächste Information bis <Uhrzeit>.“
- **Update:** „Ursache eingegrenzt: <neutral, ohne Schuldzuweisung>. Nächste Information bis <Uhrzeit>.“
- **Behoben:** „Seit <Uhrzeit> läuft <Funktion> wieder. Anrufe aus der Störungszeit finden Sie als Rückruf-Vorgänge bzw. in Ihrer Fallback-Mailbox.“
- **Bei möglichem Datenbezug** vor jeder Mitteilung die Incident-Leitung einbinden (Meldewege im Incident-Plan).

## 8. Datenschutz im Support – Kurzliste

- Mandantenwechsel nur mit Grund und Ticket-Nummer; Audit-Log zeigt jeden Zugriff.
- Exporte nie per E-Mail anhängen; der Kunde lädt sie selbst im Portal.
- Keine Rufnummern ungekürzt in Tickets.
- Support-Postfach: 2FA, Zugriff nur Support und Inhaber, Löschung alter Tickets nach der Frist im Löschkonzept.

## 9. Lernen aus dem Support

Monatlich: häufigste Fragen → Hilfeseite/FAQ ergänzen; wiederkehrende Fehler → Aufgabe (`TASK-…`) in der Roadmap; S1-Fälle → Postmortem nach Incident-Plan.

## 10. Pflege

Überprüfen bei jeder Änderung von Paketen, SLA oder Kanälen, mindestens halbjährlich. Verantwortlich: `<Name>`. Nächste Prüfung: `<Datum>`.
