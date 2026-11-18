# Backend (Express 5 + TypeScript + Neon Postgres)

## Setup
```
cp .env.example .env     # set DATABASE_URL and JWT_SECRET
npm install
npm run dev              # creates any missing tables on boot, http://localhost:5000
npm run seed             # starter branches, products, materials (safe to re-run)
ADMIN_USERNAME=owner ADMIN_PASSWORD='<strong>' npm run admin:create
```

## Database
`src/config/db.ts` is the single source of truth: the `TABLES` list.
- **Every boot** `connectNeon()` runs `CREATE TABLE IF NOT EXISTS` for each table (with retries if Neon drops the link).
- **When `IS_PRODUCTION=true`** the server also runs `syncSchema()`: it adds missing columns, converts `TIMESTAMP` to `TIMESTAMPTZ`, and **drops any table or column that is not in `TABLES`**. Removing something from `TABLES` deletes its data on the next boot.
- `syncSchema` compares column names only. It never changes an existing column's type, nullability or default.
- To add a column: add it to `TABLES`. IDs come from sequence defaults in SQL, never from app code.

## Layout
```
src/
  server.ts            connectNeon, syncSchema (production), listen, graceful shutdown
  app.ts               cors, json, routers, static, SPA fallback (non-/api only)
  config/              env.ts (fail-fast), db.ts (sql, pool, TABLES, syncSchema)
  middlewares/         auth, role (requireRole factory)
  routes/              auth, owner, sales, production  (guards always on)
  controllers/<role>/  getRequests / postRequests / updateRequests / deleteRequests + dto/*.dto.ts
  scripts/             seed.ts, createOwner.ts
  utils/               activityLogger.ts
  types/express.d.ts   req.user typing
```

## Roles (lowercase, enforced by a CHECK constraint)
`owner`, `sales-staff`, `production-head`, `production-staff`

## Adding a module
1. Add its tables to `TABLES` in `config/db.ts` (parents before children).
2. Controllers in `controllers/<role>/`, DTO namespaces beside them.
3. Register endpoints in the matching `routes/<role>.route.ts`.

## Rules
- No `NODE_ENV` branching for security. Auth is the same everywhere.
- Never return `password_hash`.
- Multi-step writes: prefer one CTE statement; use `pool.connect()` + `BEGIN/COMMIT` only when step N depends on app logic from step N-1.
