import { ENV } from "./env.js";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

if (!ENV.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

neonConfig.webSocketConstructor = ws; // required for Pool on Node < 22

export const sql = neon(ENV.DATABASE_URL); // single statements (HTTP)
export const pool = new Pool({ connectionString: ENV.DATABASE_URL }); // multi-step transactions

// =======================================================================
// TABLE DEFINITIONS
// SINGLE SOURCE OF TRUTH
// =======================================================================

type TableDefinition = {
  table: string;
  columns: Record<string, string>;
};

// Readable business IDs come from the database, never from app code.
const SEQUENCES = [
  "user_id_seq",
  "product_code_seq",
  "material_code_seq",
  "txn_code_seq",
  "dispatch_code_seq",
  "discrepancy_code_seq",
];

const TABLES: TableDefinition[] = [
  {
    // 'hub' = central kitchen (Main hub), 'branch' = selling branch
    table: "branches",
    columns: {
      id: "SERIAL PRIMARY KEY",
      name: "VARCHAR(80) NOT NULL UNIQUE",
      kind: "VARCHAR(20) NOT NULL DEFAULT 'branch' CHECK (kind IN ('hub', 'branch'))",
    },
  },

  {
    table: "users",
    columns: {
      id: "SERIAL PRIMARY KEY",
      user_id:
        "VARCHAR(255) UNIQUE NOT NULL DEFAULT 'ACC-' || LPAD(nextval('user_id_seq')::text, 3, '0')",
      username: "VARCHAR(255) NOT NULL UNIQUE",
      password_hash: "VARCHAR(255) NOT NULL",
      full_name: "VARCHAR(255) NOT NULL",
      email: "VARCHAR(255) UNIQUE",
      role: "VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'sales-staff', 'production-head', 'production-staff'))",
      // NULL = all branches
      branch_id: "INTEGER REFERENCES branches(id)",
      last_login: "TIMESTAMPTZ",
      account_status: "BOOLEAN NOT NULL DEFAULT TRUE", // false = deactivated
      active: "BOOLEAN NOT NULL DEFAULT FALSE", // online flag
      created_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      updated_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  {
    // Product master. Quantities, batches and locations belong in the sales module tables.
    table: "products",
    columns: {
      id: "SERIAL PRIMARY KEY",
      product_code:
        "VARCHAR(255) UNIQUE NOT NULL DEFAULT 'PRD-' || LPAD(nextval('product_code_seq')::text, 3, '0')",
      name: "VARCHAR(120) NOT NULL",
      description: "TEXT",
      price: "DECIMAL(10,2) NOT NULL",
      cost: "DECIMAL(10,2) NOT NULL",
      threshold: "INTEGER NOT NULL DEFAULT 0", // low-stock level
      active: "BOOLEAN NOT NULL DEFAULT TRUE",
      created_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      updated_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  {
    // Raw material master. Stock-in and daily usage belong in the dispatch module tables.
    table: "materials",
    columns: {
      id: "SERIAL PRIMARY KEY",
      material_code:
        "VARCHAR(255) UNIQUE NOT NULL DEFAULT 'MAT-' || LPAD(nextval('material_code_seq')::text, 3, '0')",
      name: "VARCHAR(120) NOT NULL",
      category: "VARCHAR(60)",
      unit: "VARCHAR(10) NOT NULL",
      cost: "DECIMAL(10,2) NOT NULL", // per unit
      threshold: "DECIMAL(10,2) NOT NULL DEFAULT 0",
      supplier: "VARCHAR(120)",
      active: "BOOLEAN NOT NULL DEFAULT TRUE",
      created_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      updated_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  {
    table: "actions",
    columns: {
      action_id: "SERIAL PRIMARY KEY",
      action_name: "VARCHAR(255) NOT NULL UNIQUE",
      action_description: "TEXT",
      module: "VARCHAR(100) NOT NULL",
      is_sensitive: "BOOLEAN NOT NULL DEFAULT TRUE",
    },
  },

  {
    table: "activity_logs",
    columns: {
      id: "SERIAL PRIMARY KEY",
      user_id: "VARCHAR(255) NOT NULL REFERENCES users(user_id)",
      action_id: "INTEGER NOT NULL",
      status: "VARCHAR(255) NOT NULL",
      target_type: "VARCHAR(100) NOT NULL",
      target_id: "VARCHAR(255) NOT NULL",
      metadata: "JSONB",
      created_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  // ---------------------------------------------------------------
  // INVENTORY & PRODUCTION (production head)
  // ---------------------------------------------------------------

  {
    // One row per production run: batch number + best-before date per product.
    table: "product_batches",
    columns: {
      id: "SERIAL PRIMARY KEY",
      batch_no: "VARCHAR(40) NOT NULL", // e.g. B-1108
      product_id: "INTEGER NOT NULL REFERENCES products(id)",
      quantity_produced: "INTEGER NOT NULL CHECK (quantity_produced >= 0)",
      best_before: "DATE",
      production_ref: "VARCHAR(40)", // e.g. PROD-044
      recorded_by: "VARCHAR(255) REFERENCES users(user_id)",
      created_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  {
    // Append-only stock ledger per product, batch and location (hub or branch).
    // quantity is signed: + adds stock, - removes it. Stock on hand = SUM(quantity).
    table: "stock_ledger",
    columns: {
      id: "SERIAL PRIMARY KEY",
      product_id: "INTEGER NOT NULL REFERENCES products(id)",
      batch_id: "INTEGER REFERENCES product_batches(id)",
      branch_id: "INTEGER NOT NULL REFERENCES branches(id)",
      movement_type:
        "VARCHAR(30) NOT NULL CHECK (movement_type IN ('opening_baseline', 'production_output', 'dispatch_out', 'receipt_in', 'sale', 'adjustment'))",
      quantity: "INTEGER NOT NULL",
      reference: "VARCHAR(60)", // BASE-1108, PROD-044, DSP-0087, TXN-0108...
      recorded_by: "VARCHAR(255) REFERENCES users(user_id)",
      created_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  // ---------------------------------------------------------------
  // DISPATCH & RECEIPTS
  // ---------------------------------------------------------------

  {
    // Hub -> branch. The hub is deducted on dispatch; the branch is credited the ACTUAL
    // received quantity on receipt. A short delivery opens a discrepancy (never a second deduction).
    table: "dispatches",
    columns: {
      id: "SERIAL PRIMARY KEY",
      dispatch_code:
        "VARCHAR(40) UNIQUE NOT NULL DEFAULT 'DSP-' || LPAD(nextval('dispatch_code_seq')::text, 4, '0')",
      product_id: "INTEGER NOT NULL REFERENCES products(id)",
      batch_id: "INTEGER REFERENCES product_batches(id)",
      branch_id: "INTEGER NOT NULL REFERENCES branches(id)", // destination
      quantity_dispatched: "INTEGER NOT NULL CHECK (quantity_dispatched > 0)",
      quantity_received: "INTEGER CHECK (quantity_received >= 0)", // NULL until receipt
      status:
        "VARCHAR(20) NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'received', 'receipt_review'))",
      prepared_by: "VARCHAR(255) REFERENCES users(user_id)",
      dispatched_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      receipt_ref: "VARCHAR(40)", // RECV-0087
      received_by: "VARCHAR(255) REFERENCES users(user_id)",
      received_at: "TIMESTAMPTZ",
      delivery_note: "TEXT",
    },
  },

  // ---------------------------------------------------------------
  // SALES & DAILY CLOSING (sales staff)
  // ---------------------------------------------------------------

  {
    table: "sales",
    columns: {
      id: "SERIAL PRIMARY KEY",
      // NULL while queued offline; assigned from txn_code_seq when synced
      txn_code: "VARCHAR(40) UNIQUE",
      // device-side reference for offline sales, used to block duplicate posting
      local_ref: "VARCHAR(40) UNIQUE",
      branch_id: "INTEGER NOT NULL REFERENCES branches(id)",
      product_id: "INTEGER NOT NULL REFERENCES products(id)",
      quantity: "INTEGER NOT NULL CHECK (quantity > 0)",
      unit_price: "DECIMAL(10,2) NOT NULL",
      line_total: "DECIMAL(12,2) NOT NULL",
      status: "VARCHAR(10) NOT NULL DEFAULT 'synced' CHECK (status IN ('synced', 'queued'))",
      sold_by: "VARCHAR(255) REFERENCES users(user_id)",
      sold_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  {
    // One closing per branch per day. status: open -> submitted (owner review) -> confirmed.
    table: "daily_closings",
    columns: {
      id: "SERIAL PRIMARY KEY",
      close_code: "VARCHAR(40) UNIQUE NOT NULL", // CLOSE-1108
      branch_id: "INTEGER NOT NULL REFERENCES branches(id)",
      closing_date: "DATE NOT NULL",
      status: "VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'confirmed'))",
      note: "TEXT",
      counted_by: "VARCHAR(255) REFERENCES users(user_id)",
      submitted_at: "TIMESTAMPTZ",
      confirmed_by: "VARCHAR(255) REFERENCES users(user_id)",
      confirmed_at: "TIMESTAMPTZ",
    },
  },

  {
    // expected = opening + received + adjustments - sales - outgoing; variance = physical - expected
    table: "closing_items",
    columns: {
      id: "SERIAL PRIMARY KEY",
      closing_id: "INTEGER NOT NULL REFERENCES daily_closings(id) ON DELETE CASCADE",
      product_id: "INTEGER NOT NULL REFERENCES products(id)",
      opening_received: "INTEGER NOT NULL",
      sold: "INTEGER NOT NULL",
      expected: "INTEGER NOT NULL",
      physical: "INTEGER NOT NULL",
      variance: "INTEGER NOT NULL",
    },
  },

  // ---------------------------------------------------------------
  // DISCREPANCIES, ADJUSTMENTS & WEEKLY AUDITS (owner)
  // ---------------------------------------------------------------

  {
    table: "discrepancies",
    columns: {
      id: "SERIAL PRIMARY KEY",
      disc_code:
        "VARCHAR(40) UNIQUE NOT NULL DEFAULT 'DISC-' || LPAD(nextval('discrepancy_code_seq')::text, 3, '0')",
      source_type: "VARCHAR(10) NOT NULL CHECK (source_type IN ('count', 'delivery'))",
      source_ref: "VARCHAR(40) NOT NULL", // CLOSE-1108 or DSP-0087
      branch_id: "INTEGER NOT NULL REFERENCES branches(id)",
      product_id: "INTEGER NOT NULL REFERENCES products(id)",
      expected_qty: "INTEGER NOT NULL",
      actual_qty: "INTEGER NOT NULL",
      variance: "INTEGER NOT NULL",
      status: "VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'recount', 'resolved'))",
      note: "TEXT", // staff note
      reason: "TEXT", // owner resolution reason
      created_by: "VARCHAR(255) REFERENCES users(user_id)",
      reviewed_by: "VARCHAR(255) REFERENCES users(user_id)",
      created_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      resolved_at: "TIMESTAMPTZ",
    },
  },

  {
    // Only an approved adjustment changes the reconciled ledger. Owner only.
    table: "stock_adjustments",
    columns: {
      id: "SERIAL PRIMARY KEY",
      discrepancy_id: "INTEGER REFERENCES discrepancies(id)", // NULL = manual owner adjustment
      product_id: "INTEGER NOT NULL REFERENCES products(id)",
      branch_id: "INTEGER NOT NULL REFERENCES branches(id)",
      quantity: "INTEGER NOT NULL", // signed
      reason: "TEXT NOT NULL",
      approved_by: "VARCHAR(255) NOT NULL REFERENCES users(user_id)",
      approved_at: "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  },

  {
    table: "weekly_audits",
    columns: {
      id: "SERIAL PRIMARY KEY",
      audit_code: "VARCHAR(40) UNIQUE NOT NULL", // AUD-2026-W45
      week_start: "DATE NOT NULL",
      week_end: "DATE NOT NULL",
      status: "VARCHAR(12) NOT NULL DEFAULT 'in_review' CHECK (status IN ('in_review', 'signed_off'))",
      total_sales: "DECIMAL(12,2) NOT NULL DEFAULT 0",
      note: "TEXT",
      signed_by: "VARCHAR(255) REFERENCES users(user_id)",
      signed_at: "TIMESTAMPTZ",
    },
  },

  // ---------------------------------------------------------------
  // SUPPLIES & USAGE (production staff / production head)
  // ---------------------------------------------------------------

  {
    table: "material_stock_in",
    columns: {
      id: "SERIAL PRIMARY KEY",
      receipt_ref: "VARCHAR(40) UNIQUE NOT NULL", // SUP-0142
      material_id: "INTEGER NOT NULL REFERENCES materials(id)",
      quantity: "DECIMAL(10,2) NOT NULL CHECK (quantity > 0)",
      unit_cost: "DECIMAL(10,2) NOT NULL",
      supplier: "VARCHAR(120)",
      received_on: "DATE NOT NULL",
      received_by: "VARCHAR(255) REFERENCES users(user_id)",
    },
  },

  {
    // Shift opening + closing count per material. used = opening + received - closing.
    // closing_qty / used_qty stay NULL until the shift is closed.
    // Current on-hand for a material = closing_qty of its latest closed record.
    table: "material_usage",
    columns: {
      id: "SERIAL PRIMARY KEY",
      record_ref: "VARCHAR(60) UNIQUE NOT NULL", // OPEN-1108-MAT-001
      usage_date: "DATE NOT NULL",
      shift: "VARCHAR(20) NOT NULL DEFAULT 'Morning'",
      material_id: "INTEGER NOT NULL REFERENCES materials(id)",
      branch_id: "INTEGER NOT NULL REFERENCES branches(id)", // location (Main hub)
      opening_qty: "DECIMAL(10,2) NOT NULL",
      received_qty: "DECIMAL(10,2) NOT NULL DEFAULT 0",
      closing_qty: "DECIMAL(10,2)",
      used_qty: "DECIMAL(10,2)",
      counted_by: "VARCHAR(255) REFERENCES users(user_id)",
      closed_by: "VARCHAR(255) REFERENCES users(user_id)",
    },
  },
];

// =======================================================================
// HELPERS
// =======================================================================

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function generateCreateTableSQL(table: TableDefinition): string {
  const definitions = Object.entries(table.columns).map(
    ([column, definition]) => `${quoteIdentifier(column)} ${definition}`,
  );

  return `
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.table)} (
      ${definitions.join(",\n")}
    )
  `;
}

// =======================================================================
// CONNECT TO DATABASE
// =======================================================================

// The link to Neon sometimes drops for a few seconds. Retry a few
// times instead of crashing the server on a single timeout.
const CONNECT_ATTEMPTS = 5;

export async function connectNeon(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await createTables();
    } catch (error) {
      if (attempt >= CONNECT_ATTEMPTS) throw error;
      const delayMs = 1000 * 2 ** (attempt - 1);
      console.warn(
        `[db] connection attempt ${attempt}/${CONNECT_ATTEMPTS} failed (${(error as Error).message}); retrying in ${delayMs / 1000}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function createTables(): Promise<void> {
  try {
    // One HTTP round trip for every statement instead of one per table.
    await sql.transaction([
      ...SEQUENCES.map((seq) =>
        sql.query(`CREATE SEQUENCE IF NOT EXISTS ${quoteIdentifier(seq)}`),
      ),
      ...TABLES.map((table) => sql.query(generateCreateTableSQL(table))),
    ]);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing DB:", error);
    throw error;
  }
}

// =======================================================================
// SYNC DATABASE SCHEMA
// =======================================================================

export async function syncSchema(onlyTables?: string[]): Promise<void> {
  try {
    console.log("[schema-sync] starting...");

    const configuredTables = onlyTables
      ? TABLES.filter((table) => onlyTables.includes(table.table))
      : TABLES;

    const configuredTableNames = configuredTables.map((table) => table.table);

    // ---------------------------------------------------------------
    // 1. GET EXISTING TABLES
    // ---------------------------------------------------------------

    const existingTableRows = (await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `) as { table_name: string }[];

    const existingTableNames = existingTableRows.map((row) => row.table_name);

    // ---------------------------------------------------------------
    // 2. DROP EXTRA TABLES
    //
    // Only during full synchronization.
    // Selective synchronization must not drop unrelated tables.
    // ---------------------------------------------------------------

    if (!onlyTables) {
      const tablesToDrop = existingTableNames.filter(
        (name) => !configuredTableNames.includes(name),
      );

      for (const tableName of tablesToDrop) {
        console.log(`[schema-sync] dropping extra table "${tableName}"`);

        await sql.query(
          `DROP TABLE IF EXISTS ${quoteIdentifier(tableName)} CASCADE`,
        );
      }
    }

    // ---------------------------------------------------------------
    // 3. PROCESS CONFIGURED TABLES
    // ---------------------------------------------------------------

    for (const tableDefinition of configuredTables) {
      const { table: tableName, columns: desiredColumns } = tableDefinition;

      // -------------------------------------------------------------
      // TABLE DOES NOT EXIST
      // -------------------------------------------------------------

      if (!existingTableNames.includes(tableName)) {
        console.log(
          `[schema-sync] ${tableName}: table does not exist, creating...`,
        );

        await sql.query(generateCreateTableSQL(tableDefinition));

        console.log(`[schema-sync] ${tableName}: created`);

        continue;
      }

      // -------------------------------------------------------------
      // GET EXISTING COLUMNS
      // -------------------------------------------------------------

      const existingColumnRows = (await sql`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
        ORDER BY ordinal_position
      `) as {
        column_name: string;
        data_type: string;
        character_maximum_length: number | null;
        numeric_precision: number | null;
        numeric_scale: number | null;
        is_nullable: string;
        column_default: string | null;
      }[];

      const existingColumnNames = existingColumnRows.map(
        (column) => column.column_name,
      );

      const desiredColumnNames = Object.keys(desiredColumns);

      // -------------------------------------------------------------
      // CHECK EXISTING PRIMARY KEY
      // -------------------------------------------------------------

      const primaryKeyRows = (await sql`
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = ${tableName}
          AND tc.constraint_type = 'PRIMARY KEY'
      `) as { column_name: string }[];

      const hasPrimaryKey = primaryKeyRows.length > 0;

      // -------------------------------------------------------------
      // FIND MISSING COLUMNS
      // -------------------------------------------------------------

      const columnsToAdd = desiredColumnNames.filter(
        (columnName) => !existingColumnNames.includes(columnName),
      );

      // -------------------------------------------------------------
      // FIND EXTRA COLUMNS
      // -------------------------------------------------------------

      const columnsToDrop = existingColumnNames.filter(
        (columnName) => !desiredColumnNames.includes(columnName),
      );

      // -------------------------------------------------------------
      // FIND TIMESTAMP COLUMNS THAT SHOULD BE TIMESTAMPTZ
      //
      // The only type change syncSchema makes. Existing values were
      // written in UTC, so they convert to the same moment.
      // -------------------------------------------------------------

      const columnsToTimestamptz = existingColumnRows
        .filter(
          (column) =>
            column.data_type === "timestamp without time zone" &&
            /^\s*TIMESTAMPTZ\b/i.test(desiredColumns[column.column_name] ?? ""),
        )
        .map((column) => column.column_name);

      for (const columnName of columnsToTimestamptz) {
        console.log(
          `[schema-sync] ${tableName}: converting "${columnName}" to TIMESTAMPTZ`,
        );

        await sql.query(`
          ALTER TABLE ${quoteIdentifier(tableName)}
          ALTER COLUMN ${quoteIdentifier(columnName)} TYPE TIMESTAMPTZ
          USING ${quoteIdentifier(columnName)} AT TIME ZONE 'UTC'
        `);
      }

      // -------------------------------------------------------------
      // NOTHING TO CHANGE
      // -------------------------------------------------------------

      if (columnsToAdd.length === 0 && columnsToDrop.length === 0) {
        if (columnsToTimestamptz.length > 0) {
          console.log(`[schema-sync] ${tableName}: schema updated`);
          continue;
        }
        console.log(`[schema-sync] ${tableName}: already in sync`);

        continue;
      }

      // -------------------------------------------------------------
      // ADD MISSING COLUMNS
      // -------------------------------------------------------------

      for (const columnName of columnsToAdd) {
        let definition = desiredColumns[columnName];

        console.log(
          `[schema-sync] ${tableName}: adding column "${columnName}"`,
        );

        const isPrimaryKey = /\bPRIMARY\s+KEY\b/i.test(definition);

        // -----------------------------------------------------------
        // PREVENT MULTIPLE PRIMARY KEYS
        //
        // If the table already has a primary key, the new column
        // must not attempt to create another one.
        // -----------------------------------------------------------

        if (isPrimaryKey && hasPrimaryKey) {
          console.warn(
            `[schema-sync] ${tableName}.${columnName}: ` +
              `existing primary key detected. Adding column without ` +
              `PRIMARY KEY constraint.`,
          );

          definition = definition.replace(/\s+PRIMARY\s+KEY\b/i, "");
        }

        const isNotNull = /\bNOT\s+NULL\b/i.test(definition);
        const hasDefault = /\bDEFAULT\b/i.test(definition);

        // -----------------------------------------------------------
        // CASE 1: NOT NULL + DEFAULT
        // -----------------------------------------------------------

        if (isNotNull && hasDefault) {
          await sql.query(`
            ALTER TABLE ${quoteIdentifier(tableName)}
            ADD COLUMN ${quoteIdentifier(columnName)} ${definition}
          `);

          continue;
        }

        // -----------------------------------------------------------
        // CASE 2: NOT NULL WITHOUT DEFAULT
        // -----------------------------------------------------------

        if (isNotNull && !hasDefault) {
          const nullableDefinition = definition.replace(/\s+NOT\s+NULL\b/i, "");

          await sql.query(`
            ALTER TABLE ${quoteIdentifier(tableName)}
            ADD COLUMN ${quoteIdentifier(columnName)} ${nullableDefinition}
          `);

          const result = (await sql.query(`
            SELECT COUNT(*)::int AS count
            FROM ${quoteIdentifier(tableName)}
            WHERE ${quoteIdentifier(columnName)} IS NULL
          `)) as { count: number }[];

          const nullCount = Number(result[0]?.count ?? 0);

          if (nullCount === 0) {
            await sql.query(`
              ALTER TABLE ${quoteIdentifier(tableName)}
              ALTER COLUMN ${quoteIdentifier(columnName)}
              SET NOT NULL
            `);

            console.log(
              `[schema-sync] ${tableName}.${columnName}: NOT NULL applied`,
            );
          } else {
            console.warn(
              `[schema-sync] ${tableName}.${columnName}: ` +
                `added as nullable because ${nullCount} existing ` +
                `row(s) contain NULL.`,
            );
          }

          continue;
        }

        // -----------------------------------------------------------
        // CASE 3: REGULAR COLUMN
        // -----------------------------------------------------------

        await sql.query(`
          ALTER TABLE ${quoteIdentifier(tableName)}
          ADD COLUMN ${quoteIdentifier(columnName)} ${definition}
        `);
      }

      // -------------------------------------------------------------
      // DROP EXTRA COLUMNS
      // -------------------------------------------------------------

      for (const columnName of columnsToDrop) {
        console.log(
          `[schema-sync] ${tableName}: dropping extra column "${columnName}"`,
        );

        await sql.query(`
          ALTER TABLE ${quoteIdentifier(tableName)}
          DROP COLUMN ${quoteIdentifier(columnName)} CASCADE
        `);
      }

      console.log(`[schema-sync] ${tableName}: schema updated`);
    }

    console.log("[schema-sync] database schema synchronized successfully");
  } catch (error) {
    console.error("[schema-sync] Error synchronizing database schema:", error);

    throw error;
  }
}
