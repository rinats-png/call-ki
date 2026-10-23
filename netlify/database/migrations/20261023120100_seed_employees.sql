-- Beispiel-Team (Platzhalter). Vor dem Livebetrieb im Hub unter "Team" anpassen.
INSERT INTO "Employee" ("id", "name", "role", "microsoftUpn", "servicePostalCodes", "directPhone") VALUES
  ('seed-notdienst', 'Notdienst Team',  'EMERGENCY_TECH', 'notdienst@storm.gmbh',        '*',                       '+4915100000001'),
  ('seed-nord',      'Techniker Nord',  'PEST_EXPERT',    'techniker.nord@storm.gmbh',   '20000-25999',             '+4915100000002'),
  ('seed-sued',      'Techniker Süd',   'PEST_EXPERT',    'techniker.sued@storm.gmbh',   '80000-87999',             '+4915100000003'),
  ('seed-west',      'Techniker West',  'PEST_EXPERT',    'techniker.west@storm.gmbh',   '40000-47999,50000-53999', '+4915100000004'),
  ('seed-b2b',       'HACCP Spezialist','B2B_SPECIALIST', 'b2b@storm.gmbh',              '20,22,40,50,80',          '+4915100000005'),
  ('seed-office',    'Backoffice',      'BACKOFFICE',     'info@storm.gmbh',             '*',                       NULL)
ON CONFLICT ("id") DO NOTHING;
