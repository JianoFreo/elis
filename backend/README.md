# Backend (Express 5 + TypeScript + Neon Postgres)

## Setup
```
cp .env.example .env     # set DATABASE_URL and JWT_SECRET
npm install
npm run db:init          # applies src/db/migrations/*.sql (additive, tracked in schema_migrations)
ADMIN_USERNAME=owner ADMIN_PASSWORD='<strong>' npm run admin:create
npm run dev              # http://localhost:5000
```

## Layout
```
src/
  server.ts            connectDb, listen, graceful shutdown
  app.ts               cors, json, routers, static, SPA fallback (non-/api only)
  config/              env.ts (fail-fast), db.ts (sql + pool)
  db/migrations/       001_init.sql ...   (new column/table = new numbered file, never drop)
  middlewares/         auth, role (requireRole factory)
  routes/              auth, owner, sales, production  (guards always on)
  controllers/<role>/  getRequests / postRequests / updateRequests / deleteRequests + dto/*.dto.ts
  scripts/             initDb.ts, createOwner.ts
  types/express.d.ts   req.user typing
```

## Roles (lowercase, matched by DB CHECK)
`owner`, `sales-staff`, `production-head`, `production-staff`

## Adding a module
1. New migration `00N_<module>.sql` (use sequences + DEFAULT for readable IDs, never generate IDs in TypeScript).
2. Controllers in `controllers/<role>/`, DTO namespaces beside them.
3. Register endpoints in the matching `routes/<role>.route.ts`.

## Rules
- No `syncSchema`-style code. No `NODE_ENV` branching for security.
- Never return `password_hash`.
- Multi-step writes: prefer one CTE statement; use `pool.connect()` + `BEGIN/COMMIT` only when needed.
