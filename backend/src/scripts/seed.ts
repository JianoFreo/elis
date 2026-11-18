import { connectNeon, sql, pool } from "../config/db.js";

// Creates any missing tables, then inserts starter data. Safe to re-run (nothing is duplicated).
await connectNeon();

await sql`INSERT INTO branches (name, kind) VALUES
  ('Main hub','hub'), ('Main Street','branch'), ('Market Road','branch'), ('Town Center','branch')
  ON CONFLICT (name) DO NOTHING`;

await sql`INSERT INTO actions (action_name, module, is_sensitive) VALUES
  ('user.create','users',FALSE), ('user.activate','users',TRUE), ('user.deactivate','users',TRUE),
  ('product.update','products',FALSE), ('material.update','materials',FALSE)
  ON CONFLICT (action_name) DO NOTHING`;

await sql`INSERT INTO products (name, description, price, cost, threshold)
  SELECT v.* FROM (VALUES
    ('Chicken empanada', 'Hand-folded chicken empanada.', 65, 38, 40),
    ('Cheese roll',      'Freshly baked cheese roll.',    45, 24, 30),
    ('Banana loaf',      'Fresh banana loaf.',           120, 72, 30)
  ) AS v(name, description, price, cost, threshold)
  WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.name)`;

await sql`INSERT INTO materials (name, category, unit, cost, threshold, supplier)
  SELECT v.* FROM (VALUES
    ('All-purpose flour', 'Baking flour',      'kg',  55,  10, 'Local Milling Co.'),
    ('Butter',            'Dairy',             'kg', 220,   5, 'Dairy Supply Co.'),
    ('Chicken filling',   'Filling',           'kg', 180,   8, 'Fresh Market'),
    ('White sugar',       'Baking ingredient', 'kg',  65,   2, 'Local Milling Co.')
  ) AS v(name, category, unit, cost, threshold, supplier)
  WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.name = v.name)`;

console.log("Seeded branches, actions, products, materials");
await pool.end();
