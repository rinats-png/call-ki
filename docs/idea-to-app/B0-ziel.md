# Ziel & Zugang

> B0 im Modus „Bestehende App“ (`modes/bestehende-app.md`), nachgetragen am 2026-10-24. Die Antworten stammen aus den Gesprächen vom 2026-10-23/24 (B1-Vorschlag „Weiterentwickeln + Absichern“), aus `docs/OFFENE-PUNKTE.md` und dem Audit vom 2026-10-24 (`OP-…`-IDs). Was der Projektinhaber nicht ausdrücklich gesagt hat, ist als Annahme markiert.

| Punkt | Festlegung |
|---|---|
| Ziel | **Weiterentwickeln + Absichern** (Reihenfolge: erst absichern und nachweisen, dann neue Funktionen) – Ziel ist der Verkauf an mehrere zahlende Betriebe (Mandanten) |
| Zugang | Repository `rinats-png/call-ki`, lokal unter `/home/user/call-ki` (Branch `claude/awesome-johnson-2wmjas`); Regelwerk unter `/home/user/rinats-png/idea-to-app` (v1.2.0) |
| Live mit echten Nutzern | **nein** – Testumgebung auf Netlify ohne echte Kundendaten; Produktionsserver (IONOS-VPS) noch nicht eingerichtet; kein Anruf mit echten Anbieter-Konten durchgeführt |
| Bekannte Probleme | Tool-, Ereignis- und Signaturformate der Sprach-KI-Anbieter nur aus Doku umgesetzt (B1 BF-17); Verträge (AVV) und Rechtsunterlagen nicht abgeschlossen bzw. ungeprüft (54 PRÜFEN-Markierungen in `docs/recht/`); keine echten Rechnungen; Aufzeichnung rechtlich ungeklärt |
| Unveränderlich | Stack Next.js 15 + Prisma/PostgreSQL + Docker auf IONOS-VPS (kein Technologiewechsel ohne `E-…`); Telefonie über Twilio; Sprach-KI wählbar je Kunde (Retell, Vapi, ElevenLabs); Glas-Design (Entwürfe G01–G13) bleibt; Daten möglichst in Deutschland/EU [ANNAHME A-003] |

## Zielgruppe (Kurzfassung, keine eigene Phase 3)
- **Kunden (Mandanten):** kleine Betriebe in Deutschland mit vielen Anrufen und wenig Büro – Branchenvorlagen im Code: Schädlingsbekämpfung, Handwerk (SHK, Elektro, Dach), allgemeiner Dienstleister (`src/lib/tenant/templates.ts`) [ANNAHME A-004].
- **Anrufer:** Privat- und Gewerbekunden dieser Betriebe, deutschsprachig, oft in Eile oder im Notfall [ANNAHME A-005].
- **Betreiber:** Plattform-Admin (eine Person bzw. sehr kleines Team) [ANNAHME A-007].
