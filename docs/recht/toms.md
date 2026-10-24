# Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

> Anlage 2 zum AVV. **Keine Rechtsberatung.** Jede technische Aussage ist im Code belegt (Spalte „Beleg“); organisatorische Maßnahmen mit ☐ sind noch umzusetzen bzw. nachzuweisen. Konkrete Sicherheitswerte: `docs/sicherheit.md`. Stand: 2026-10-24 (ergänzt: Vapi, ElevenLabs, Google, Microsoft, S3-Backup, Überwachung, Kostenschutz, Twilio-Gesprächsende, Schlüsselwechsel).

## 1. Vertraulichkeit

### 1.1 Zutrittskontrolle (Rechenzentrum)
| Maßnahme | Beleg |
|---|---|
| Betrieb auf einem VPS bei IONOS SE in einem Rechenzentrum in Deutschland **[PRÜFEN: Standort im IONOS-Vertrag]**; physische Sicherheit durch IONOS (ISO 27001 **[PRÜFEN: Zertifikat ablegen]**) | IONOS-AVV/Zertifikat |
| Keine eigenen Server-Räume, keine Datenträger außerhalb des Rechenzentrums | – |

### 1.2 Zugangskontrolle (Systeme)
| Maßnahme | Beleg |
|---|---|
| Server-Zugang nur per SSH-Schlüssel, kein Root-Login, Firewall nur 22/80/443, fail2ban, automatische Sicherheitsupdates | `deploy/harden.sh`, `docs/betrieb.md` → „Server einrichten“ · Nachweis auf dem Produktionsserver: ☐ ablegen |
| Passwörter im Portal: scrypt (N=2^17, r=8, p=1), Mindestlänge 12, Prüfung gegen geleakte Passwörter (HIBP, k-Anonymität) | `src/lib/auth/crypto.ts`, `src/lib/auth/pwned.ts` |
| Zwei-Faktor-Authentisierung (TOTP), **Pflicht für Plattform-Admins**, für Kunden-Admins per `REQUIRE_TENANT_ADMIN_2FA` | `src/lib/auth/totp.ts`, `src/lib/auth/session.ts` |
| 2FA-Geheimnisse verschlüsselt (AES-256-GCM), Wiederherstellungscodes gehasht und einmalig | `src/lib/secret-box.ts`, `src/lib/auth/mfa.ts` |
| Sitzungen: zufällige Token, nur Hash gespeichert, HttpOnly/Secure/SameSite=Lax; Admin 30 min Inaktivität / 12 h absolut | `src/lib/auth/session.ts` |
| Rate-Limits für Login, Reset, 2FA, API, Webhooks (429 + Retry-After), keine dauerhafte Kontosperre; sicherheitsrelevante Zähler gemeinsam in PostgreSQL (Schlüssel gehasht, 2 Tage) | `src/lib/rate-limit.ts`, Test `tests/rate-limit.test.ts` |
| Betreiber-Zugänge (GitHub, IONOS inkl. Object Storage, Twilio, Retell, Vapi, ElevenLabs, Netlify, Google Cloud, Microsoft Entra, Registrar, SMTP, Lebenszeichen-Dienst) mit 2FA, Ablage der Wiederherstellungscodes | Liste `docs/betreiber-konten.md` · ☐ nachweisen |

### 1.3 Zugriffskontrolle (Berechtigungen)
| Maßnahme | Beleg |
|---|---|
| Rollen: Plattform-Admin, Kunden-Admin, Kunden-Nutzer; serverseitig aus der Sitzung | `requireTenant`, `requirePlatformAdmin` |
| Strikte Mandantentrennung: jede Abfrage mit `tenantId` aus der Sitzung; fremde Datensätze → 404 | Test `tests/integration/tenancy.test.ts` |
| Mandant eines Anrufs wird aus der angerufenen Nummer bzw. eigenem Anrufdatensatz bestimmt, **nie** aus KI-Ausgaben; Tool-Aufrufe nur für laufende Anrufe; Kundendaten nur zur echten Anrufernummer | `src/lib/voice/handle-tools.ts`, `src/lib/voice/context.ts` |
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
| Webhooks signiert bzw. mit Geheimnis: Twilio-Signatur (in Produktion nicht abschaltbar, auch für die Statusmeldung `/api/twilio/status`), Retell-Signatur, ElevenLabs-Webhook-Geheimnis, eigenes Tool-Geheimnis **je Anbieter** (Retell, Vapi, ElevenLabs, SIP) | `src/lib/security.ts`, `src/lib/voice/*`, `src/app/api/twilio/*` |
| Gespeicherte Geheimnisse mit `APP_ENCRYPTION_KEY` verschlüsselt (AES-256-GCM, mit Schlüsselkennung): 2FA-Geheimnisse, in der Oberfläche gespeicherte Anbieter-Schlüssel (`PlatformSetting`), Google-Refresh-Tokens (`Integration.secretEnc`); Schlüsselwechsel ohne Ausfall (`APP_ENCRYPTION_KEYS_OLD`, `/api/cron/rekey`). Microsoft: keine Tokens gespeichert (Client-Credentials) | `src/lib/secret-box.ts`, `src/lib/services/rekey.ts`, `src/lib/google.ts`, `src/lib/graph.ts`, `docs/betrieb.md` → „Schlüsselwechsel“ |
| Backups mit age verschlüsselt, privater Schlüssel getrennt vom Bucket-Zugang im Tresor | `deploy/backup.sh`, `docs/betrieb.md` → Backups |
| Datenträgerverschlüsselung des VPS | ☐ prüfen (IONOS-Angebot) **[PRÜFEN]** |

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
| Tägliches Datenbank-Backup, lokal 14 Tage | `deploy/backup.sh` |
| Externe, verschlüsselte Kopie im S3-kompatiblen Object Storage (IONOS, Region Deutschland **[PRÜFEN]**), 30 Tage; Versionierung/Object Lock empfohlen | `deploy/backup.sh` · Einrichtung auf Produktion ☐ |
| Automatischer Wiederherstellungstest monatlich (Wegwerf-Datenbank), Alarm bei Fehlschlag oder > 35 Tagen | `deploy/restore-test.sh`, `src/lib/services/monitor.ts` · erster Test auf Produktion ☐ Datum |
| Ausfallsicherheit am Telefon: Fällt die KI aus, Kunde pausiert oder Minutenlimit erreicht → Weiterleitung/Mailbox | `src/lib/voice/fallback.ts` |
| Fällt der ganze Server aus: Twilio-gehostetes Ersatzziel je Nummer (TwiML Bin), stündliche Prüfung über die Twilio-API | `src/lib/voice/twilio-fallback.ts`, `src/lib/voice/twilio-config.ts` · je Nummer ☐ einrichten |
| Überwachung alle 5 Minuten mit Alarm per E-Mail/SMS/Webhook (Notfall-Alarm nicht zugestellt, Backup, Speicher, hängende Anrufe, Twilio-Konfiguration); externer Lebenszeichen-Dienst für Serverausfall | `src/lib/services/monitor.ts`, `docs/betrieb.md` · Lebenszeichen-Dienst ☐ einrichten |
| Gesprächsende unabhängig vom KI-Anbieter über die Twilio-Statusmeldung; hängende Anrufe werden geschlossen, damit Abrechnung und Löschung greifen | `src/app/api/twilio/status`, `src/lib/services/calls.ts` (`closeStaleCalls`) |
| E-Mails/SMS außerhalb des Gesprächspfads mit bis zu 5 Zustellversuchen | `src/lib/notify/index.ts`, Test `tests/notify-retry.test.ts` |
| Container mit Neustart-Policy, Healthcheck | `docker-compose.yml`, `/api/health` |
| Kosten-/Missbrauchsbremse: Minutenlimit je Mandant, Anrufe je Anrufer/Stunde, gleichzeitige Anrufe je Mandant und gesamt, maximale Gesprächsdauer, Tagesbudget, Notschalter, Kontingent-Warnungen 80/100 % | `src/lib/cost-guard.ts`, `src/lib/services/usage-alerts.ts`, `LIMITS.callsPerCaller` |

## 4. Verfahren zur regelmäßigen Überprüfung
| Maßnahme | Beleg |
|---|---|
| CI bei jedem Push: Lint, Typprüfung, Tests (inkl. Mandantentrennung), `npm audit`, gitleaks | `.github/workflows/ci.yml` |
| Automatische Update-Hinweise (Dependabot) | `.github/dependabot.yml` |
| Datenschutzfreundliche Voreinstellungen: Aufzeichnung aus, Löschfrist 365 Tage (kürzbar ab 7 Tagen) | `src/lib/tenant/settings.ts` |
| Jährliche Überprüfung dieser TOM, Incident-Übung; Release nur nach Checkliste mit Backup vor Migration und Rollback-Weg | `docs/release-checkliste.md` · ☐ Termin |
| Auftragskontrolle: Weisungen nur dokumentiert (Ticket/E-Mail), Unterauftragnehmer nur mit AVV | `avv-vorlage.md` §§ 3, 7 |
| Verpflichtung aller Personen mit Zugriff auf Vertraulichkeit | ☐ Verpflichtungserklärungen ablegen |
