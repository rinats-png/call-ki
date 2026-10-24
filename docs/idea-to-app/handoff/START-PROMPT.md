# Start-Prompt für das Coding-Tool

> Kopiere den Text im Kasten als **erste Nachricht** in dein Coding-Tool (Claude Code, Codex, Cursor, Copilot …), das im bestehenden Repository `call-ki` arbeitet. Das Paket bleibt unter `docs/idea-to-app/handoff/` liegen – es wird nicht ins Wurzelverzeichnis kopiert.

```text
Du arbeitest im bestehenden Repository meiner App „KI-Telefonzentrale“ (call-ki): Next.js 15, Prisma 6 mit PostgreSQL 16, Twilio und Sprach-KI (Retell, Vapi, ElevenLabs). Die App ist weitgehend gebaut; es geht um Nachweise, Restlücken und Launch-Vorbereitung.

1. Lies zuerst docs/idea-to-app/handoff/AGENTS.md vollständig. Die Regeln dort – besonders Abschnitt 5 „Nicht verhandelbare Sicherheitsregeln“ – gelten für jede Aufgabe.
2. Lies danach im Paket docs/idea-to-app/handoff/docs/: produkt.md, architektur.md, sicherheit.md, roadmap.md; dazu docs/idea-to-app/22-handoff.md (Code-Landkarte, Konventionen) und README.md.
3. Prüfe den Stand: `git status`, `git log --oneline -15`. Vergleiche mit dem Code-Stand in AGENTS.md (Commit 5279652) und nenne Abweichungen.
4. Fasse mir in maximal 10 Zeilen zusammen, was du verstanden hast, und nenne Unklarheiten oder Widersprüche zwischen Unterlagen und Code.
5. Kläre mit mir die offenen Annahmen und Entscheidungen aus AGENTS.md Abschnitt 6 – eine Frage nach der anderen, nur die, die für die nächste Aufgabe nötig sind.
6. Beginne dann mit der ersten offenen Aufgabe aus docs/idea-to-app/handoff/docs/roadmap.md (Meilenstein M-S zuerst). Eine Aufgabe nach der anderen. Aufgaben, die echte Konten, den Server oder eine Fachperson brauchen, nicht simulieren – sag mir, was ich tun muss.
7. Wenn du vom Plan abweichen musst, halte dich an AGENTS.md Abschnitt 7: kleine Abweichungen in docs/idea-to-app/handoff/docs/aenderungen.md dokumentieren, wesentliche vorher mit mir abstimmen.

Arbeitsregeln in diesem Repository:
- Branches: nie direkt auf den Standard-Branch committen. Arbeite auf einem Feature-Branch (für KI-Sitzungen `claude/<kurzes-thema>` bzw. den Branch, den die Sitzung vorgibt) und öffne einen Pull Request; fertig ist eine Aufgabe erst mit grüner CI (.github/workflows/ci.yml).
- Vor jedem Commit: `npm run lint && npm run typecheck && npm test`.
- Integrationstests (tests/integration/*) laufen nur mit einer eigenen, leeren Test-Datenbank: `TEST_DATABASE_URL` setzen, `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy`, dann `npm test`. Nie gegen die Entwicklungs- oder Produktionsdatenbank.
- HTTP- und Browser-Tests gegen den echten Build: `TEST_DATABASE_URL=… bash scripts/e2e.sh` (leert die Test-Datenbank; `E2E_SKIP_BUILD=1` nutzt einen vorhandenen Build). Pflicht, wenn API-Routen, Middleware, Anmeldung oder Oberfläche berührt sind.
- Commits: eine Betreffzeile als deutscher Satz, der das Ergebnis beschreibt (ohne Präfix), darunter eine Aufzählung mit „- “ (was und warum, Tests, Doku, offene Entscheidungen). Ein Commit = ein Thema. Trailer-Zeilen so, wie die Sitzung sie vorgibt.
- Keine Geheimnisse committen: keine echten Schlüssel, Passwörter, Tokens oder personenbezogenen Testdaten – auch nicht in Tests, Fixtures, Doku oder Logs. Neue Variablen nur als Name mit Platzhalter in .env.example (tests/env-example.test.ts prüft das). Wird doch etwas committet: sofort melden, Schlüssel widerrufen und neu erzeugen.
- Datenbankschema nur über versionierte Migrationen (`npx prisma migrate dev --name <name>`), Kopie nach netlify/database/migrations/ (tests/netlify-migrations.test.ts), nur rückwärtskompatibel (expand/contract), nie von Hand in Produktion, vor jeder Migration in Produktion ein Backup (deploy/deploy.sh macht das).
- Nach jeder Aufgabe den Status in docs/idea-to-app/handoff/docs/roadmap.md und docs/idea-to-app/21-roadmap.md nachtragen (mit Commit).

Ich bin Entwickler. Erkläre mir nach jeder Aufgabe kurz, was du gemacht hast und was ich ausprobieren kann. Wenn ich etwas tun muss (z. B. ein Konto bei einem Dienst anlegen oder einen Schlüssel eintragen), erkläre mir die Schritte – und sag mir, wo der Schlüssel hingehört (.env auf dem Server oder Verwaltung → Verbindungen), ohne dass ich ihn dir in den Chat schreiben muss.
```

## Tipps

- **Geheime Schlüssel** nie in den Chat kopieren. Trage sie selbst in die `.env` auf dem Server (Rechte 600) oder in der Oberfläche unter Verwaltung → Verbindungen ein (dort verschlüsselt gespeichert). Werte aus der Oberfläche überlagern gleichnamige `.env`-Werte (Paket-`docs/sicherheit.md`).
- Nach jedem Meilenstein **selbst ausprobieren** – auch die Sonderfälle aus Paket-`docs/flows-und-screens.md` und die Testanrufe aus `docs/testanrufe.md`.
- Wenn das Tool vom Plan abweicht: auf `docs/idea-to-app/handoff/AGENTS.md` und die Dokumente unter `docs/` verweisen.
- Wenn du den Plan ändern willst: zurück in **idea-to-app** (Modus „Bestehende App“), betroffene Phase anpassen, Handoff neu erzeugen.
