# SAD Group 3 - Eli's Yummy Kitchen Inventory & Sales System



## Overview
A web-based system that tracks sales, product stock, dispatches to branches, raw materials, discrepancies, weekly audits, staff accounts, and reports for Eli's Yummy Kitchen.

## Repository structure
| Folder | Contents | Owner |
| --- | --- | --- |
| `frontend/` | React + Vite + Tailwind app (login, role shells, role pages) | Developers |
| `backend/` | Express + TypeScript API on Postgres (Neon) | Developers |
| `docs/` | Diagrams, user manual, technical docs, final document | Documentation Specialist |
| `tests/` | Test plan, test cases, test results, bug log | Tester / QA |
| `management/` | Task board, sprint notes, progress reports, checklists | Project Manager, Scrum Master |

## Team and roles
| Role | Members |
| --- | --- |
| Project Manager | John Michael Litana |
| Product Owner | Princess Ann Delos Reyes, Clark Jerzon Herrera |
| Scrum Master | Hazel Baniqued, Clark Jerzon Herrera |
| Developer | Jiano Magtangob, John Michael Litana, Princess Ann Delos Reyes |
| Tester / QA | Ericka Nucos, Hazel Baniqued, Jiano Magtangob |
| Documentation Specialist | Ericka Nucos |

## Development split (3 developers)
Each developer owns their modules and files so we avoid merge conflicts.

| Developer | Owns | Backend files | Frontend screens | Branches |
| --- | --- | --- | --- | --- |
| **Jm (John Michael Litana)** | Foundation (setup, schema, login and roles), Accounts and permissions, Reports and CSV, Deployment and final integration | `backend/src/app.ts`, `routes/auth.route.ts`, `routes/owner.route.ts`, `config/db.ts` (base tables) | login, shift, accounts, permissions, reports | `feature/auth`, `feature/accounts`, `feature/reports` |
| **Princess Ann Delos Reyes** | Products, production, stock baseline, Sales and daily closing (with offline sync) | `backend/src/routes/sales.route.ts`, `controllers/sales/`, sales tables in `config/db.ts` | overview, sales, record-sale, offline, count, closing, inventory, product, production, stock-in, next-opening | `feature/products`, `feature/sales` |
| **Jiano Magtangob** | Dispatch and receipts, Materials and usage, Discrepancies and weekly audits | `backend/src/routes/production.route.ts`, `controllers/production/`, dispatch tables in `config/db.ts` | dispatches, receive, supplies, usage, discrepancies, review, adjust, audits | `feature/dispatch`, `feature/materials`, `feature/discrepancies` |

### Rules to avoid conflicts
1. Jm pushes the backend skeleton, base schema, and login first (target: Thursday, Nov 19, noon). Others build on top of it.
2. One route file and one controllers folder per module. Only edit your own files.
3. Add your own tables to the `TABLES` list in `backend/src/config/db.ts`, grouped together in your own block, parents before children. They are created on boot.
4. Build your screens under `frontend/src/users/<role>/pages/` and register them in that role's shell.
5. Pull the latest `main` before starting work, commit small and often, and merge through pull requests.
6. Discrepancies and audits depend on sales closing and dispatch receipts, so Jiano builds that part last.

## Running the system
1. Backend: copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL` and `JWT_SECRET`, then in `backend/` run `npm install`, `npm run dev` (port 5000; tables are created on boot), then `npm run seed` and `ADMIN_USERNAME=owner ADMIN_PASSWORD='<strong>' npm run admin:create`.
2. Frontend: in `frontend/` run `npm install` and `npm run dev` (proxies `/api` to localhost:5000).
3. Production build: from the repo root, `npm run build` then `npm start` (one service serves API and frontend). `render.yaml` is included.

Roles: `owner`, `sales-staff`, `production-head`, `production-staff`. See `backend/README.md`.
## Git workflow (all members)
1. Never commit directly to `main`.
2. Create a branch per task: `feature/<short-name>`, `docs/<short-name>`, `test/<short-name>`.
3. Commit small and often with clear messages, for example `Add sales API endpoint`.
4. Open a pull request, link the related issue, and get one teammate's review before merging.
5. Pull the latest `main` before starting new work.

## Commit message format
`<type>: <what changed>` where type is one of `feat`, `fix`, `docs`, `test`, `chore`.