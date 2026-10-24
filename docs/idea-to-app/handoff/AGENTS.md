# KI-Telefonzentrale (call-ki) – Anweisungen für das Coding-Tool

> Diese Datei wurde mit **idea-to-app** erstellt (Phase 22, Modus „Bestehende App“). Sie ist verbindlich für jede Aufgabe in diesem Repository.
>
> **Regelwerk-Version:** 1.2.0 · **Erstellt:** 2026-10-24 · **Code-Stand:** Commit `5279652` (Branch `claude/awesome-johnson-2wmjas`)

**Pfade:** Das Paket liegt unter `docs/idea-to-app/handoff/`. Mit „Paket-`docs/…`“ sind die Dateien in `docs/idea-to-app/handoff/docs/` gemeint; alle anderen Pfade sind relativ zur Repository-Wurzel (z. B. `docs/sicherheit.md` = Projektwerte der App, `src/lib/…`).

## 1. Worum geht es?

Mandantenfähige KI-Telefonzentrale: Betriebe leiten ihre Nummer auf eine Twilio-Nummer um, eine Sprach-KI (Retell, Vapi oder ElevenLabs je Mandant) nimmt an, erfasst Anliegen, bucht Termine, stellt Notfälle durch und benachrichtigt per E-Mail/SMS; der Betrieb sieht alles im Portal, der Betreiber verwaltet Mandanten, Pakete und Abrechnung.

- **Zielgruppe:** kleine Betriebe in Deutschland (Schädlingsbekämpfung, Handwerk, Dienstleister) und deren Anrufer [A-004, A-005]
- **Kernfunktion:** Anruf jederzeit annehmen, KI legt sich offen, nimmt das Anliegen auf, bucht Termin oder stellt im Notfall durch (`docs/idea-to-app/05-mvp.md`)
- **Risikostufe:** 2 – Konten, personenbezogene Daten Dritter, Sprachaufnahmen und Transkripte; **Tendenz 3**, weil Transkripte Gesundheitsangaben enthalten können (E-017, DSFA-Schwellwertprüfung offen)
- **Plattform:** Web-App (Next.js 15) + Telefonkanal; Produktion IONOS-VPS mit Docker Compose, Testumgebung Netlify (E-016)
- **Stand:** fast alle Muss-Funktionen sind gebaut; offen ist vor allem der **Nachweis** mit echten Konten, Produktionsserver und Verträgen (Paket-`docs/roadmap.md`).

Lies vor jeder Aufgabe die referenzierten Abschnitte. Das Paket fasst knapp zusammen und verweist auf die echten Dokumente im Repository – bei Widerspruch gilt der Code bzw. das verwiesene Dokument, und der Widerspruch wird gemeldet.

| Datei (in `docs/idea-to-app/handoff/`) | Inhalt |
|---|---|
| `docs/produkt.md` | Idee, Zielgruppe, Funktionsumfang (F-IDs) |
| `docs/flows-und-screens.md` | Abläufe, Zustände, Screens, Navigation |
| `docs/design.md` | Glas-Design, Barrierefreiheit |
| `docs/daten-und-rechte.md` | Datenmodell, Klassifizierung, Berechtigungsmatrix |
| `docs/architektur.md` | Tech-Stack, Dienste, Qualitätsziele, Code-Landkarte |
| `docs/sicherheit.md` | Zugriffs-Antwortstrategie, Rate-Limits, Schlüsselliste (nur Namen) |
| `docs/recht.md` | Rechtliche Funktionen (Export, Löschung, Einwilligung, Fristen) |
| `docs/tests.md` | Akzeptanzkriterien, Teststrategie, Sicherheitstests, Befehle |
| `docs/betrieb.md` | Deployment, Monitoring, Backups, Rückweg |
| `docs/roadmap.md` | Meilensteine und Aufgaben mit IDs und Status |
| `docs/entscheidungen.md` | Entscheidungen und bewusst akzeptierte Risiken |
| `docs/aenderungen.md` | Abweichungen vom Plan während der Umsetzung (Abschnitt 7) |
| `START-PROMPT.md` | Erste Nachricht an das Coding-Tool |

Mockups: keine eigenen (Phase 8 übersprungen, Glas-Design ist umgesetzt); der Code unter `src/app/` und `src/components/` ist die Referenz.

## 2. Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind 3, lucide-react |
| Backend | Next.js Route Handlers (Node.js 22), zod 4 für Eingaben, nodemailer |
| Datenbank | PostgreSQL 16 über Prisma 6 (Migrationen in `prisma/migrations/`, Kopien in `netlify/database/migrations/`) |
| Auth | Eigenbau: scrypt, Sitzungen in der DB (Cookie `ck_session`), TOTP-2FA, Re-Auth (`src/lib/auth/*`) |
| Telefonie / Sprach-KI | Twilio; Retell, Vapi, ElevenLabs (SIP-Anbieter „nicht freigegeben“, E-023) |
| Hosting | IONOS-VPS, Docker Compose (app, db, caddy, cron, backup); Netlify nur Test |
| Tests | Vitest (Unit, Integration gegen Postgres), Vitest + fetch / Playwright gegen echten Build (`scripts/e2e.sh`), gitleaks, `npm audit`, Build-Scan (`scripts/scan-build.sh`) |

Keine weiteren Frameworks oder Abhängigkeiten ohne Rückfrage. Major-Updates (Prisma 7, Next 16, vitest 5, Tailwind 4) nur als eigene Aufgabe (TASK-040, TASK-064, E-003).

## 3. Arbeitsweise

1. Arbeite die Aufgaben aus Paket-`docs/roadmap.md` **der Reihe nach** ab (M-S zuerst), eine nach der anderen. Beginne erst eine neue Aufgabe, wenn die vorherige die Definition of Done erfüllt. Aufgaben, die echte Konten, den Server oder eine Fachperson brauchen, nicht „simulieren“ – dem Projektinhaber sagen, was er tun muss.
2. Kleine Schritte: Eine Aufgabe ändert nur, was für sie nötig ist. Ein Commit = ein Thema.
3. Vor dem Umsetzen: kurz sagen, was du vorhast und welche Dateien du änderst.
4. **Tests gehören zur Aufgabe.** Bei Funktionen mit Nutzerdaten immer auch der Test „anderer Mandant / anderer Nutzer hat keinen Zugriff“ (404 laut Zugriffs-Antwortstrategie).
5. Nach jeder Aufgabe: Status in Paket-`docs/roadmap.md` und `docs/idea-to-app/21-roadmap.md` aktualisieren (mit Commit), in 2–3 Sätzen in einfacher Sprache berichten, was der Projektinhaber jetzt ausprobieren kann. Abweichungen vom Plan nach Abschnitt 7.
6. **Bei Unklarheit fragen, nicht raten.** Offene Annahmen und Entscheidungen stehen in Abschnitt 6.
7. Nach jedem Meilenstein: kurze Klick-Checkliste für den Projektinhaber ausgeben und auf seine Abnahme warten.
8. Behaupte nie, etwas funktioniere, ohne es getestet zu haben.

Projektkonventionen (Sprache Deutsch, Mandantentrennung über `tenantId` aus der Sitzung, zod + `readJson`, Geheimnisse über `setting()`/Registry, maskierte Logs, Timeouts, UTC, Cron-Endpunkte, Paketgrenzen serverseitig, Sprach-KI-Änderungen in `voice-agent/*`, Doku nachziehen): `docs/idea-to-app/22-handoff.md` Abschnitt 5. Befehle, Branches und Commits: `START-PROMPT.md` und `docs/idea-to-app/22-handoff.md` Abschnitte 4 und 6.

## 4. Definition of Done (jede Aufgabe)

- [ ] Akzeptanzkriterien (`AK-…`) aus `docs/idea-to-app/19-tests.md` erfüllt; zugehörige Tests (`TEST-…`, `T-SEC-…`) grün
- [ ] `npm run lint && npm run typecheck && npm test` grün; Integrationstests mit `TEST_DATABASE_URL` und E2E über `scripts/e2e.sh` grün, wenn Datenbank, API-Routen oder Oberfläche berührt sind; CI grün
- [ ] Sicherheitsregeln (Abschnitt 5) eingehalten
- [ ] Keine Fehler/Warnungen in Konsole und Linter
- [ ] Barrierefreiheit beachtet (Beschriftungen, Kontrast, Tastatur)
- [ ] Texte deutsch und an einer Stelle gepflegt (eine i18n-Struktur gibt es noch nicht, TASK-052)
- [ ] Neue Umgebungsvariablen in `.env.example`; Schemaänderung nur als versionierte Migration (auch nach `netlify/database/migrations/`)
- [ ] Betroffene Doku nachgezogen (`docs/recht/*`, `docs/betrieb.md`, `docs/sicherheit.md`, `docs/idea-to-app/*`)
- [ ] Paket-`docs/roadmap.md` aktualisiert

## 5. Nicht verhandelbare Sicherheitsregeln

Wörtlich aus `security/regeln-fuer-ki.md` von idea-to-app 1.2.0 (ab „Grundsatz“; nur die Überschriftenebene ist um eins abgesenkt, Regelnummern unverändert).

### Grundsatz

Der Client (Browser, App) ist **nicht vertrauenswürdig**. Alles, was von dort kommt – IDs, Rollen, Preise, Formularfelder, Header – kann manipuliert sein. Sicherheit wird **auf dem Server** und in der **Datenbank** durchgesetzt.

### 1. Geheimnisse

- 1.1 Geheime Schlüssel (Service-Role/Secret Keys, API-Keys für KI/SMS/E-Mail, Datenbank-Passwörter, Webhook-Secrets) MÜSSEN ausschließlich serverseitig verwendet werden. Sie DÜRFEN NIE im Frontend-Code, in Umgebungsvariablen mit Client-Präfix (z. B. `VITE_`, `NEXT_PUBLIC_`, `EXPO_PUBLIC_`), im App-Paket oder im Repository stehen.
- 1.2 Öffentliche Schlüssel (z. B. Supabase Publishable/Anon Key) DÜRFEN im Frontend stehen, aber NUR wenn die zugehörigen Zugriffsregeln (Row Level Security / Security Rules) aktiv sind.
- 1.3 `.env*` MUSS in `.gitignore` stehen. Eine `.env.example` mit Platzhaltern MUSS existieren.
- 1.4 Wird ein Geheimnis versehentlich committet, MUSS es sofort widerrufen und neu erzeugt werden. Nur aus der Git-Historie löschen reicht nicht.

### 2. Zugriffskontrolle

- 2.1 Jeder Endpunkt bzw. jede Datenbankabfrage, die nutzerbezogene Daten liest, ändert oder löscht, MUSS serverseitig prüfen, ob der angemeldete Nutzer dazu berechtigt ist (Besitz, Gruppenmitgliedschaft, Rolle) – gemäß `docs/daten-und-rechte.md`.
- 2.2 Standard ist **verweigern** (deny by default). Neue Tabellen MÜSSEN mit aktivierter Row Level Security bzw. gesperrten Security Rules angelegt werden.
- 2.3 Eine ID aus URL, Query, Body oder Header ist KEIN Berechtigungsnachweis.
- 2.4 Fehlt die Berechtigung, MUSS die Antwort der in `docs/sicherheit.md` festgelegten Zugriffs-Antwortstrategie folgen (Standard: 404 wie bei „nicht vorhanden“). In keinem Fall dürfen Inhalte, Metadaten oder Hinweise auf den fremden Datensatz zurückgegeben werden.
- 2.5 Listen- und Suchendpunkte MÜSSEN serverseitig auf erlaubte Datensätze filtern.
- 2.6 Felder wie `id`, `owner_id`, `user_id`, `role`, `is_admin`, `plan`, `status`, `price`, `created_at` DÜRFEN NICHT aus Client-Eingaben übernommen werden. Eingaben werden über eine Allowlist erlaubter Felder verarbeitet (kein Mass Assignment).
- 2.7 Rollen und Berechtigungen MÜSSEN aus der serverseitigen Sitzung bzw. Datenbank kommen, nie aus dem Client.
- 2.8 Dateien MÜSSEN privat gespeichert und nur über kurzlebige, signierte URLs nach Berechtigungsprüfung ausgeliefert werden.
- 2.9 Das Verstecken von Buttons oder Menüpunkten ist KEINE Zugriffskontrolle.
- 2.10 Admin-Aktionen MÜSSEN protokolliert werden (wer, was, wann).

### 3. Authentisierung & Sitzungen

- 3.1 Es MUSS der in `docs/sicherheit.md` festgelegte Login-Anbieter bzw. die festgelegte Bibliothek verwendet werden. Keine selbst geschriebene Krypto.
- 3.2 Falls Passwörter selbst gespeichert werden: nur mit einem Passwort-Hashing-Verfahren (Argon2id bevorzugt; sonst scrypt oder bcrypt) mit den Parametern aus `docs/sicherheit.md`. Niemals Klartext, Verschlüsselung statt Hashing, MD5 oder einfache SHA-Hashes.
- 3.3 Passwortregeln gemäß `docs/sicherheit.md`: Mindest- und Maximallänge, alle Zeichen erlaubt, Einfügen erlaubt (Passwort-Manager), Prüfung gegen bekannte geleakte Passwörter, keine Pflicht-Sonderzeichen.
- 3.4 Login, Registrierung und Passwort-Reset MÜSSEN identisch antworten, unabhängig davon, ob ein Konto existiert (keine Nutzer-Enumeration).
- 3.5 Reset-, Bestätigungs- und Einladungs-Tokens: kryptografisch zufällig, gehasht gespeichert, einmalig, mit Ablaufzeit gemäß `docs/sicherheit.md`. Nach Passwortänderung alle Sitzungen beenden.
- 3.6 Sitzungs-Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` oder strenger. Neue Sitzungs-ID nach Login. Logout beendet die Sitzung serverseitig. Laufzeiten und erneute Anmeldung für sensible Aktionen gemäß `docs/sicherheit.md`.
- 3.7 Admins MÜSSEN Zwei-Faktor-Authentisierung nutzen; für normale Nutzer gilt die Festlegung in `docs/sicherheit.md`.

### 4. Missbrauchsschutz

- 4.1 Login, Registrierung, Passwort-Reset, E-Mail-/SMS-Versand und alle kostenverursachenden Endpunkte MÜSSEN serverseitig rate-limitiert sein – pro Konto **und** pro IP – gemäß der Tabelle in `docs/sicherheit.md`.
- 4.2 Bei wiederholten Fehlanmeldungen: steigende Wartezeit und vorübergehende Sperre, ggf. CAPTCHA. KEINE dauerhafte automatische Kontosperre.
- 4.3 Überschreitung → HTTP 429 mit `Retry-After`.
- 4.4 Anfragegröße, Upload-Größe und Seitengröße von Listen MÜSSEN gemäß `docs/sicherheit.md` begrenzt sein.
- 4.5 Nutzungsabhängige Dienste (KI, SMS, Karten) MÜSSEN ein Limit pro Nutzer und eine Budget-Grenze haben.

### 5. Eingaben & Ausgaben

- 5.1 Alle Eingaben MÜSSEN serverseitig mit einem Schema validiert werden (Typ, Länge, Format, erlaubte Werte).
- 5.2 Datenbankzugriffe NUR parametrisiert bzw. über ORM/Query-Builder. Keine String-Verkettung mit Eingaben.
- 5.3 Nutzerinhalte MÜSSEN beim Ausgeben escaped werden. Kein `innerHTML`/`dangerouslySetInnerHTML`/`v-html` mit ungefilterten Nutzerdaten; wenn HTML nötig ist, mit einer Sanitizer-Bibliothek bereinigen.
- 5.4 Bei cookie-basierten Sitzungen MUSS CSRF-Schutz aktiv sein.
- 5.5 Uploads: Typ anhand des Inhalts prüfen, Größenlimit, zufälliger Dateiname, privat speichern, nie ausführen.
- 5.6 Serverseitige Abrufe fremder URLs NUR über Allowlist; interne Adressen sperren (SSRF).
- 5.7 Weiterleitungen NUR auf eigene, bekannte Ziele.

### 6. Transport & Browser

- 6.1 Nur HTTPS; HSTS aktiv.
- 6.2 Security-Header gemäß `docs/sicherheit.md` MÜSSEN gesetzt sein: mindestens `Content-Security-Policy` (inkl. `frame-ancestors`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- 6.3 CORS NUR für eigene Domains. Kein `*` bei Endpunkten mit Anmeldung.

### 7. Daten & Datenschutz

- 7.1 Nur die in `docs/daten-und-rechte.md` definierten Daten speichern (Datensparsamkeit).
- 7.2 Keine Passwörter, Tokens, Gesundheits- oder andere sensible Daten in Logs, URLs, Fehlermeldungen, Analytics oder Push-Texten.
- 7.3 „Konto löschen“ MUSS alle personenbezogenen Daten inkl. Dateien tatsächlich löschen (bzw. nach der dokumentierten Backup-Frist).
- 7.4 Datenexport NUR für den angemeldeten Nutzer selbst.
- 7.5 Schriften, Icons und Skripte möglichst lokal ausliefern statt von Drittservern.

### 8. Zahlungen, Webhooks, KI

- 8.1 Preise, Produkte und Freischaltungen bestimmt ausschließlich der Server. Freischaltung NUR nach verifizierter Zahlungsbestätigung (Webhook/Server-API), nie über Client-Parameter.
- 8.2 Webhooks: Signatur prüfen, Zeitstempel prüfen, idempotent verarbeiten.
- 8.3 Keine Kartendaten selbst speichern.
- 8.4 KI-Funktionen: Ausgaben eines Sprachmodells sind nicht vertrauenswürdig – nie ungeprüft als Code, SQL, HTML oder Berechtigungsentscheidung verwenden. Dem Modell nur Daten geben, die der aktuelle Nutzer sehen darf.

### 9. Abhängigkeiten & Fehler

- 9.1 Neue Abhängigkeiten nur mit Begründung; verbreitete, gepflegte Pakete bevorzugen; Lockfile einchecken.
- 9.2 Bekannte Schwachstellen (z. B. `npm audit` hoch/kritisch) MÜSSEN vor einem Release behoben oder dokumentiert werden.
- 9.3 Nutzer sehen allgemeine Fehlermeldungen; technische Details nur im Server-Log.
- 9.4 Sicherheitsereignisse (Logins, Fehlversuche, verweigerte Zugriffe, Admin-Aktionen, Rate-Limit-Treffer) werden protokolliert.
- 9.5 Vor dem Installieren einer neuen Abhängigkeit prüfen, dass das Paket wirklich existiert und das gemeinte ist (genauer Name, Herausgeber, Pflegestand). Sprachmodelle erfinden Paketnamen, und Angreifer registrieren solche Namen. Im Zweifel nachfragen.
- 9.6 CI-Workflows, Aktionen und Skripte von Dritten nur aus vertrauenswürdigen Quellen, mit festgelegter Version und minimalen Rechten. Geheimnisse erscheinen nie in Build- oder Testprotokollen.
- 9.7 Änderungen am Datenbankschema nur über versionierte Migrationen, nie von Hand in Produktion, und vor jeder Migration ein Backup.

### 10. Arbeitsweise

- 10.1 Für jede Funktion, die nutzerbezogene Daten liest oder schreibt, MUSS ein automatisierter Test existieren, der den Zugriff eines **anderen** Nutzers prüft (erwartet: verweigert).
- 10.2 Sicherheitstests aus `docs/tests.md` MÜSSEN in der CI laufen und grün sein, bevor eine Aufgabe als erledigt gilt.
- 10.3 Wenn eine Anforderung mit diesen Regeln kollidiert: NICHT eigenmächtig abweichen, sondern den Projektinhaber fragen und die Entscheidung dokumentieren.
- 10.4 Keine Sicherheitsregel „vorübergehend“ abschalten, um etwas zum Laufen zu bringen (z. B. RLS deaktivieren, CORS auf `*`, Validierung auskommentieren).
- 10.5 Behaupte nie, eine Sicherheitsanforderung sei erfüllt, ohne Nachweis (Testergebnis, Konfiguration, Fundstelle).

Alle konkreten Werte, auf die diese Regeln verweisen (Passwort-Hashing, Längen, Laufzeiten, Rate-Limits, Größenlimits, Header, Zugriffs-Antwortstrategie, Schlüsselliste), stehen in **Paket-`docs/sicherheit.md`** (Quelle: `docs/sicherheit.md` und `docs/idea-to-app/14-sicherheit.md`). Gibt es dort für eine Regel keinen Wert: nicht raten, sondern nachfragen.

**Projektbezogene Ausnahmen** (bewusst akzeptierte Risiken, nicht erweitern ohne Zustimmung): E-001 CSP mit `'unsafe-inline'` (Regel 6.2), E-002 Webhook-/API-Zähler im Prozessspeicher (Regel 4.1), E-003 `npm audit`-Funde nur in Entwicklungswerkzeugen bis 2026-11-15 (Regel 9.2), E-004 keine Postgres-RLS (Regel 2.2 – Mandantentrennung über `tenantId` in jeder Abfrage plus Integrationstest). Zu Regel 3.1: Es gibt keinen externen Login-Anbieter; festgelegt ist der Eigenbau in `src/lib/auth/*` (E-018) – keine neue Krypto daneben, nur `node:crypto`.

## 6. Offene Annahmen – vor Umsetzung beim Projektinhaber klären

Quelle: `docs/idea-to-app/PROJECT_STATE.md`, Abschnitt „Annahmen“ (alle mit „Bestätigt: nein“). A-010 ist nicht vergeben.

| ID | Annahme | Betrifft |
|---|---|---|
| A-001 | Kein fester Launch-Termin; Soft Launch, sobald M-S bis M4 erledigt sind | Roadmap, E-020 |
| A-002 | Zeitbudget pro Woche nicht festgelegt; Roadmap-Dauern sind Schätzungen | Roadmap |
| A-003 | Daten sollen möglichst in Deutschland/EU verarbeitet werden (IONOS, EU-Regionen der Anbieter, wo möglich) | Anbieterwahl, TASK-031 |
| A-004 | Zielkunden sind kleine Betriebe in Deutschland (Schädlingsbekämpfung, Handwerk, Dienstleister) laut Branchenvorlagen | Produkt, `src/lib/tenant/templates.ts` |
| A-005 | Anrufer sprechen Deutsch und sitzen in Deutschland; Zeitzone Europe/Berlin | Sprach-KI, Zeitlogik, F-33 |
| A-006 | Eine eigene Sprach-KI auf GPU-Server lohnt erst ab mehreren tausend Minuten im Monat | F-40 |
| A-007 | Der Betreiber ist ein Kleinstunternehmen (unter 10 Beschäftigte, höchstens 2 Mio. € Umsatz) | BFSG, Recht |
| A-008 | Wochenanfang Montag; Geschäftstage je Mandant wählbar | Kalender, Anzeige |
| A-009 | Kunden wollen Annahme rund um die Uhr (keine eigene Ansage „außerhalb der Geschäftszeiten“) | F-01, Flows |
| A-011 | Der hohe `npm audit`-Fund in prisma 6 betrifft nur die CLI, nicht die Laufzeit | E-003, TASK-040 |
| A-012 | Die Kostenschutz-Standardwerte (5 je Kunde, 50 gesamt, 20 min) passen zu den Tarifen der KI-Anbieter | F-25, E-014 |
| A-013 | Hub zeigt im Leerzustand einen Hinweis auf den ersten Testanruf; bei Verbindungsverlust bleibt der letzte Stand sichtbar – nicht im Browser geprüft | F-12 |
| A-014 | Mitarbeiter sehen Team (lesend), Tarif und Protokoll; Bearbeiten nur Kunden-Admin | Berechtigungen, `12-berechtigungen.md` |
| A-015 | Für B2B genügt: Zugänge entfernt der Kunden-Admin, Mandanten löscht der Betreiber; kein Self-Service „eigenes Konto löschen“ | Recht (Regel 7.3), F-14, F-27 |
| A-016 | Fehlermeldungen im Portal erscheinen als Text, nicht nur farbig – nicht im Browser geprüft | Barrierefreiheit, TASK-042 |

**Offene Entscheidungen des Projektinhabers** (nicht selbst entscheiden): E-010 Aufzeichnung standardmäßig aus · E-020 Soft Launch mit Pilotbetrieben · E-021 externe Fachprüfung oder akzeptiertes Risiko · E-022 Repository privat und Branch-Schutz. Dazu aus `docs/OFFENE-PUNKTE.md`: Frist für Vorgangstexte, privater Backup-Schlüssel auf dem Server, Risikostufe 3 statt 2.

## 7. Abweichungen vom Plan (Rückweg)

Der Plan in `docs/idea-to-app/` (zusammengefasst in diesem Paket) ist die verbindliche Grundlage. Wenn sich beim Bauen zeigt, dass etwas anders gemacht werden muss:

1. **Kleine Abweichung** (Detail ohne Auswirkung auf Daten, Rechte, Sicherheit, Kosten oder Umfang): umsetzen, in Paket-`docs/aenderungen.md` eintragen und das betroffene Dokument anpassen (meist unter `docs/idea-to-app/` oder `docs/`).
2. **Wesentliche Abweichung** (neue oder geänderte Funktion, Rolle, Datenfeld, externer Dienst, Löschfrist, Preis, Kosten, oder eine Sicherheitsregel ist berührt): **anhalten und den Projektinhaber fragen.** Erst nach Zustimmung umsetzen, dann Paket-`docs/aenderungen.md`, betroffene Dokumente (`docs/recht/*`, `docs/sicherheit.md`, `docs/idea-to-app/*`), Akzeptanzkriterien und Tests aktualisieren.
3. **Größere Erweiterung:** dem Projektinhaber empfehlen, sie mit idea-to-app im Modus „Bestehende App“ (Ziel „Weiterentwickeln“) zu planen.

Jeder Eintrag in Paket-`docs/aenderungen.md` nennt die betroffenen IDs (`F-…`, `AK-…`, `T-SEC-…`, `TASK-…`, `E-…`). Ein Plan, der nicht mehr zum Code passt, ist ein Fehler – kein Detail.

## 8. Vor einer Veröffentlichung zusätzlich nötig

- Launch-Gate `docs/idea-to-app/23-launch.md` (Stand: „Nicht freigabefähig“) mit Prüfskript `--launch` ohne FEHLER. Jeder Haken in der Launch-Liste braucht einen **nachprüfbaren Nachweis** (Datum, Link, Dateipfad, ID oder Commit-Nummer).
- Noch nicht abgeschlossene Phasen (laut `PROJECT_STATE.md` „in Arbeit“): 11–20 und 22. Ihre Dokumente sind inhaltlich vorhanden, aber nicht formal abgenommen.
- Nachweise mit echten Konten und Produktionsserver: Testanrufe je Anbieter (`docs/testanrufe.md`), Ersatzziel (TwiML Bin) je Nummer, Backups mit Wiederherstellungstest, externe Überwachung, AVV/DPA mit allen Anbietern, fachliche Klärung der `[PRÜFEN]`-Stellen in `docs/recht/`.
- Risikostufe 2 mit Tendenz 3: Wird auf Stufe 3 eingeordnet, ist vor der Veröffentlichung für andere eine **externe Fachprüfung** nötig – oder eine bewusst akzeptierte, dokumentierte Entscheidung dagegen (E-021). Eine zweite KI ersetzt sie nicht.
