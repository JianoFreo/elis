-- Base schema. IDs are produced by the database (sequences as column DEFAULTs).
-- Module tables (sales, dispatch, ...) go in 002_*.sql, 003_*.sql ... additive only, never drop.

CREATE SEQUENCE IF NOT EXISTS user_id_seq;
CREATE SEQUENCE IF NOT EXISTS product_code_seq;
CREATE SEQUENCE IF NOT EXISTS material_code_seq;

-- 'hub' = central kitchen (Main hub), 'branch' = selling branch
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'branch' CHECK (kind IN ('hub','branch'))
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE DEFAULT 'ACC-' || LPAD(nextval('user_id_seq')::text, 3, '0'),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner','sales-staff','production-head','production-staff')),
  branch_id INT REFERENCES branches(id),          -- NULL = all branches
  account_status BOOLEAN NOT NULL DEFAULT TRUE,   -- false = deactivated
  active BOOLEAN NOT NULL DEFAULT FALSE,          -- online flag
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product master. Quantities, batches and locations belong in the sales module migration.
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE DEFAULT 'PRD-' || LPAD(nextval('product_code_seq')::text, 3, '0'),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  threshold INT NOT NULL DEFAULT 0,               -- low-stock level
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Raw material master. Stock-in and daily usage belong in the dispatch module migration.
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  material_code TEXT NOT NULL UNIQUE DEFAULT 'MAT-' || LPAD(nextval('material_code_seq')::text, 3, '0'),
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  cost NUMERIC(10,2) NOT NULL,                    -- per unit
  threshold NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS actions (
  action_id SERIAL PRIMARY KEY,
  action_name TEXT NOT NULL UNIQUE,
  module TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO actions (action_name, module, is_sensitive) VALUES
  ('user.create','users',FALSE), ('user.activate','users',TRUE), ('user.deactivate','users',TRUE),
  ('product.update','products',FALSE), ('material.update','materials',FALSE)
ON CONFLICT (action_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id),
  action_id INT REFERENCES actions(action_id),
  status TEXT NOT NULL CHECK (status IN ('success','failure','blocked')),
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO branches (name, kind) VALUES
  ('Main hub','hub'), ('Main Street','branch'), ('Market Road','branch'), ('Town Center','branch')
ON CONFLICT (name) DO NOTHING;
