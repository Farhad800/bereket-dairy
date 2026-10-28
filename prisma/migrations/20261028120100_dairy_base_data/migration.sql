-- Bereket Dairy: built-in rows the app expects (carried over from the plastic system's migrations).
-- The main safe (holds IQD, USD and EUR; can't be deleted) and the built-in expense categories.
INSERT INTO "Safe" ("id", "name", "currencies", "isMain", "updatedAt")
VALUES ('safe_main', 'Main safe', ARRAY['IQD', 'USD', 'EUR']::"Currency"[], true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "ExpenseCategory" ("id", "key", "name") VALUES
  ('expcat_salaries', 'SALARIES', 'Salaries'),
  ('expcat_electricity', 'ELECTRICITY', 'Electricity'),
  ('expcat_fuel', 'FUEL', 'Fuel / generator'),
  ('expcat_rent', 'RENT', 'Rent'),
  ('expcat_maintenance', 'MAINTENANCE', 'Maintenance & spare parts'),
  ('expcat_transport', 'TRANSPORT', 'Transport'),
  ('expcat_food', 'FOOD', 'Food'),
  ('expcat_other', 'OTHER', 'Other')
ON CONFLICT DO NOTHING;
