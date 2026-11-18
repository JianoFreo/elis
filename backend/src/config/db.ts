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
const SEQUENCES = ["user_id_seq", "product_code_seq", "material_code_seq"];

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
