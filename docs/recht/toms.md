# Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

> Anlage 2 zum AVV. **Keine Rechtsberatung.** Jede technische Aussage ist im Code belegt (Spalte „Beleg“); organisatorische Maßnahmen mit ☐ sind noch umzusetzen bzw. nachzuweisen. Konkrete Sicherheitswerte: `docs/sicherheit.md`. Stand: 2026-10-23.

## 1. Vertraulichkeit

### 1.1 Zutrittskontrolle (Rechenzentrum)
| Maßnahme | Beleg |
|---|---|
| Betrieb auf einem VPS bei IONOS SE in einem Rechenzentrum in Deutschland **[PRÜFEN: Standort im IONOS-Vertrag]**; physische Sicherheit durch IONOS (ISO 27001 **[PRÜFEN: Zertifikat ablegen]**) | IONOS-AVV/Zertifikat |
| Keine eigenen Server-Räume, keine Datenträger außerhalb des Rechenzentrums | – |

### 1.2 Zugangskontrolle (Systeme)
| Maßnahme | Beleg |
|---|---|
| Server-Zugang nur per SSH-Schlüssel, kein Passwort-Login, Firewall nur 22/80/443 | Firewall: `README.md` (ufw 22/80/443) · SSH nur mit Schlüssel: ☐ umsetzen und dokumentieren |
| Passwörter im Portal: scrypt (N=2^17, r=8, p=1), Mindestlänge 12, Prüfung gegen geleakte Passwörter (HIBP, k-Anonymität) | `src/lib/auth/crypto.ts`, `src/lib/auth/pwned.ts` |
| Zwei-Faktor-Authentisierung (TOTP), **Pflicht für Plattform-Admins**, für Kunden-Admins per `REQUIRE_TENANT_ADMIN_2FA` | `src/lib/auth/totp.ts`, `src/lib/auth/session.ts` |
| 2FA-Geheimnisse verschlüsselt (AES-256-GCM), Wiederherstellungscodes gehasht und einmalig | `src/lib/secret-box.ts`, `src/lib/auth/mfa.ts` |
| Sitzungen: zufällige Token, nur Hash gespeichert, HttpOnly/Secure/SameSite=Lax; Admin 30 min Inaktivität / 12 h absolut | `src/lib/auth/session.ts` |
| Rate-Limits für Login, Reset, 2FA, API, Webhooks (429 + Retry-After), keine dauerhafte Kontosperre | `src/lib/rate-limit.ts`, Test `tests/rate-limit.test.ts` |
| Betreiber-Zugänge (GitHub, IONOS, Twilio, Retell, Domain, E-Mail) mit 2FA | ☐ nachweisen |

### 1.3 Zugriffskontrolle (Berechtigungen)
| Maßnahme | Beleg |
|---|---|
| Rollen: Plattform-Admin, Kunden-Admin, Kunden-Nutzer; serverseitig aus der Sitzung | `requireTenant`, `requirePlatformAdmin` |
| Strikte Mandantentrennung: jede Abfrage mit `tenantId` aus der Sitzung; fremde Datensätze → 404 | Test `tests/integration/tenancy.test.ts` |
| Mandant eines Anrufs wird aus der angerufenen Nummer bzw. eigenem Anrufdatensatz bestimmt, **nie** aus KI-Ausgaben | `src/lib/voice/handle-tools.ts` |
| Erneute Anmeldung (≤ 15 min) für Export, Mandantenwechsel, 2FA-Änderung, Mandantenlöschung | `requireRecentAuth` |
| Aufnahmen nur über eigenen, berechtigungsgeprüften Endpunkt, Abruf protokolliert; Anbieter-Hosts per Allowlist (SSRF-Schutz) | `calls/[id]/recording`, `src/lib/voice/providers.ts` |
| Plattform-Admin-Zugriff auf Mandantendaten nur über protokollierten Mandantenwechsel | `admin/switch`, Audit-Log |

### 1.4 Trennungskontrolle
| Maßnahme | Beleg |
|---|---|
| Logische Trennung je Mandant (`tenantId` an jeder Tabelle); getrennte Umgebungen Entwicklung/Produktion | `prisma/schema.prisma` |
| Bewusst akzeptiert: keine Row Level Security in der Datenbank (E-004) | `docs/sicherheit.md` |

### 1.5 Pseudonymisierung / Verschlüsselung
| Maßnahme | Beleg |
|---|---|
| Transport: TLS über Caddy (automatische Zertifikate), HSTS | `deploy/Caddyfile` |
| Webhooks signiert (Twilio-Signatur, Retell-Signatur, eigenes Tool-Secret) | `src/lib/voice/*`, `src/app/api/twilio/*` |
| Gespeicherte Geheimnisse (2FA) verschlüsselt; Integrations-Tokens nicht gespeichert (Microsoft per Client-Credentials) | `src/lib/secret-box.ts`, `src/lib/graph.ts` |
| Datenträgerverschlüsselung des VPS / verschlüsselte externe Backups | ☐ umsetzen (siehe Löschkonzept, Backups) |

## 2. Integrität
| Maßnahme | Beleg |
|---|---|
| Eingaben serverseitig mit Schema validiert (zod), Größenlimit 100 KB | `src/lib/http.ts`, zod-Schemas in den API-Routen |
| Nur ORM-Abfragen (Prisma), keine String-SQL | Code |
| CSRF-Schutz (Origin-Prüfung), CSP und Security-Header | `src/middleware.ts`, `next.config.ts` |
| Audit-Log für Admin-Aktionen, Logins, Exporte, Aufnahmeabrufe, Löschungen (2 Jahre) | `src/lib/audit.ts` |
| Schemaänderungen nur über versionierte Migrationen | `prisma/migrations/` |

## 3. Verfügbarkeit und Belastbarkeit
| Maßnahme | Beleg |
|---|---|
| Tägliches Datenbank-Backup, 14 Tage Aufbewahrung | `deploy/backup.sh` |
| Externe, verschlüsselte Kopie der Backups | ☐ umsetzen (`README.md`) |
| Wiederherstellungstest vor Launch, danach vierteljährlich | ☐ Datum eintragen |
| Ausfallsicherheit am Telefon: Fällt die KI aus, Kunde pausiert oder Minutenlimit erreicht → Weiterleitung/Mailbox | `src/lib/voice/fallback.ts` |
| Fällt der ganze Server aus: Twilio-gehostetes Ersatzziel je Nummer (TwiML Bin) | ☐ einrichten |
| Container mit Neustart-Policy, Healthcheck | `docker-compose.yml`, `/api/health` |
| Kosten-/Missbrauchsbremse: Minutenlimit je Mandant, Anrufe je Anrufer/Stunde | `minutesThisMonth`, `LIMITS.callsPerCaller` |

## 4. Verfahren zur regelmäßigen Überprüfung
| Maßnahme | Beleg |
|---|---|
| CI bei jedem Push: Lint, Typprüfung, Tests (inkl. Mandantentrennung), `npm audit`, gitleaks | `.github/workflows/ci.yml` |
| Automatische Update-Hinweise (Dependabot) | `.github/dependabot.yml` |
| Datenschutzfreundliche Voreinstellungen: Aufzeichnung aus, Löschfrist 365 Tage (kürzbar ab 7 Tagen) | `src/lib/tenant/settings.ts` |
| Jährliche Überprüfung dieser TOM, Incident-Übung | ☐ Termin |
| Auftragskontrolle: Weisungen nur dokumentiert (Ticket/E-Mail), Unterauftragnehmer nur mit AVV | `avv-vorlage.md` §§ 3, 7 |
| Verpflichtung aller Personen mit Zugriff auf Vertraulichkeit | ☐ Verpflichtungserklärungen ablegen |
