# Tests

> Phase 19 („in Arbeit“), Stand 2026-10-24. **Maßgeblich:** `docs/idea-to-app/19-tests.md` – Akzeptanzkriterien `AK-F<nr>-<n>` je Funktion, Testliste `TEST-…`, Rückverfolgungsmatrix (Funktion → Kriterium → Test → Aufgabe), Teststrategie, letzte Testläufe, Pflicht-Sicherheitstests `T-SEC-01…33`, fehlende Tests. Testanrufe: `docs/testanrufe.md`. Release: `docs/release-checkliste.md`.

## Befehle

```bash
npm run lint && npm run typecheck && npm test      # Pflicht vor jedem Commit (Unit-Tests; Integration ohne DB übersprungen)

# Integration gegen eigene, leere Test-Datenbank (nie Dev oder Produktion)
export TEST_DATABASE_URL=postgresql://<nutzer>:<passwort>@localhost:5432/callki_test
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
npm test                                            # führt jetzt auch tests/integration/* aus

# HTTP- und Browser-Tests gegen den echten Build (leert die Test-DB)
TEST_DATABASE_URL=… bash scripts/e2e.sh            # E2E_SKIP_BUILD=1 nutzt einen vorhandenen Build

# Last (nur gegen Produktions-Build mit Test-DB, nie gegen Produktion)
CALLS=30 npx tsx scripts/loadtest.ts
```

Entwicklungs-Datenbank: `docker compose -f docker-compose.dev.yml up -d` (Details `docs/idea-to-app/22-handoff.md` Abschnitt 4).

## Ebenen

| Ebene | Ort | In CI |
|---|---|---|
| Unit | `tests/*.test.ts` | ja |
| Integration (Mandantentrennung, Sprach-Pipeline, Kostenschutz, Löschung, Monatsabschluss, Schlüsselwechsel, Alarme) | `tests/integration/tenancy.test.ts` | ja (Postgres-Dienst) |
| HTTP gegen Build: T-SEC-HTTP-01…16 (401/404/403, CSRF, 2FA-Pflicht, Re-Auth, Webhooks/Cron ohne Geheimnis, Header, Enumeration, fremde Datensätze ändern/löschen, Rollen im Body, Reset-Links, Kollegen-Links, fremde Aufnahmen, Logout serverseitig) | `tests/e2e/http.test.ts` | ja (nach dem Build) |
| Browser (Playwright): Login mit 2FA, Mandantentrennung, falsches Passwort | `tests/e2e/ui.test.ts` | ja |
| Statisch: gitleaks, `npm audit --omit=dev --audit-level=high`, Build-Scan mit Kanarienwerten | `.github/workflows/ci.yml`, `scripts/scan-build.sh` | ja |
| Vertragstests mit echten Payloads | `tests/fixtures/<anbieter>/` | **offen** (TASK-061) |
| Testanrufe (20 Szenarien je Anbieter) | `docs/testanrufe.md` | manuell, **noch kein Durchlauf** |
| Barrierefreiheit (axe) | – | **offen** (TASK-043) |

Letzter belegter Stand (lokal, 2026-10-24): Unit 133 grün, Integration 31/31, E2E 17/17 (vor `669cc2f`); Lasttest ohne Fehler. Nach jeder Aufgabe den Lauf in `19-tests.md` → „Letzte Testläufe“ nachtragen.

## Regeln

- Jede Funktion mit Nutzerdaten: Test „anderer Mandant / anderer Nutzer“ → 404 bzw. 403 (Regel 10.1).
- Sicherheitstests T-SEC-… laufen in der CI und müssen grün sein, bevor eine Aufgabe erledigt ist (Regel 10.2).
- Testdaten nur erfunden; keine echten Rufnummern, Namen oder Schlüssel in Tests und Fixtures (Fixtures anonymisieren).
- Offene Tests: `19-tests.md` → „Fehlende Tests (offen)“; Gegenprobe-Lauf (Schutz entfernen → Test rot) ist eingeplant, Ergebnis nach `docs/idea-to-app/pruefungen/gegenprobe-<datum>.md`.
