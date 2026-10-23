-- Testdaten der Einzelkunden-Version (vor der Mandantenfähigkeit) aufbewahren, nicht löschen:
-- Tabellen samt Indizes in ein eigenes Schema verschieben, damit das neue Datenmodell
-- dieselben Tabellennamen nutzen kann.
CREATE SCHEMA IF NOT EXISTS "legacy";
ALTER TABLE IF EXISTS "public"."CallTicket" SET SCHEMA "legacy";
ALTER TABLE IF EXISTS "public"."Customer" SET SCHEMA "legacy";
ALTER TABLE IF EXISTS "public"."Employee" SET SCHEMA "legacy";
