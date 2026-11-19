# Technical Documentation – Eli's Yummy Kitchen Inventory & Sales System

Source of the facts below: the project README. Items marked (ask) must be confirmed with the developers before you submit.

## 1. System Overview
A web-based system that tracks sales, product stock, dispatches to branches, raw materials, discrepancies, weekly audits, staff accounts, and reports for Eli's Yummy Kitchen. SAD Group 3, BS Information Systems, TUP Manila.

## 2. Technology Stack
| Layer | Technology | Folder |
|-------|-----------|--------|
| Frontend | React + Vite + Tailwind (login, role shells, role pages) | frontend/ |
| Backend | Express + TypeScript API | backend/ |
| Database | PostgreSQL hosted on Neon | (DATABASE_URL) |
| Authentication | JWT (JWT_SECRET in the environment file) | backend/ |
| Hosting | render.yaml is included in the repo (ask: confirm the host, URL, and who owns the account) | repo root |

## 3. User Roles
owner, sales-staff, production-head, production-staff (see backend/README.md for what each can do).

## 4. Modules and Ownership
| Developer | Modules | Backend files | Frontend screens | Branches |
|-----------|---------|---------------|------------------|----------|
| John Michael Litana | Foundation (setup, schema, login and roles), Accounts and permissions, Reports and CSV, Deployment and final integration | backend/src/app.ts, routes/auth.route.ts, routes/owner.route.ts, config/db.ts (base tables) | login, shift, accounts, permissions, reports | feature/auth, feature/accounts, feature/reports |
| Princess Ann Delos Reyes | Products, production, stock baseline, Sales and daily closing (with offline sync) | backend/src/routes/sales.route.ts, controllers/sales/, sales tables in config/db.ts | overview, sales, record-sale, offline, count, closing, inventory, product, production, stock-in, next-opening | feature/products, feature/sales |
| Jiano Magtangob | Dispatch and receipts, Materials and usage, Discrepancies and weekly audits | backend/src/routes/production.route.ts, controllers/production/, dispatch tables in config/db.ts | dispatches, receive, supplies, usage, discrepancies, review, adjust, audits | feature/dispatch, feature/materials, feature/discrepancies |

Rules the team follows: one route file and one controllers folder per module; each developer edits only their own files; tables are added to the TABLES list in backend/src/config/db.ts (parents before children) and are created when the server starts; screens live in frontend/src/users/<role>/pages/ and are registered in that role's shell.

## 5. How to Run (Development)
**Backend**
1. Copy backend/.env.example to backend/.env.
2. Set DATABASE_URL and JWT_SECRET (never commit .env).
3. In backend/ run `npm install`, then `npm run dev` (port 5000; tables are created on boot).
4. Run `npm run seed`.
5. Create the owner account: `ADMIN_USERNAME=owner ADMIN_PASSWORD='<strong password>' npm run admin:create`.

**Frontend**
1. In frontend/ run `npm install`, then `npm run dev`.
2. The dev server proxies /api to localhost:5000.

## 6. How to Run (Production Build)
From the repo root: `npm run build`, then `npm start`. One service serves both the API and the frontend. render.yaml holds the deployment settings.

## 7. Database
- Tables are defined in backend/src/config/db.ts (TABLES list) and created on boot.
- Insert the ERD and data dictionary from docs/diagrams/diagram-notes.md.
- Compare the real tables with the ERD and list differences (ask the developers for the table list).

## 8. API Endpoints
Complete from the route files, one table per module (ask each developer to confirm).
| Route file | Module | Method | Endpoint | Role allowed | Purpose |
|------------|--------|--------|----------|--------------|---------|
| routes/auth.route.ts | Login and roles | | | | |
| routes/owner.route.ts | Accounts, permissions, reports | | | | |
| routes/sales.route.ts | Sales, daily closing, offline sync | | | | |
| routes/production.route.ts | Dispatch, materials, discrepancies, audits | | | | |

## 9. Git Workflow
Never commit to main. One branch per task (feature/, docs/, test/). Commit format `<type>: <what changed>` with type feat, fix, docs, test, or chore. Open a pull request, link the issue, and get one teammate's review. Pull the latest main before starting new work.

## 10. Security Notes
- JWT secret and database URL are environment variables and must not be committed.
- Access is limited by role.

## 11. Known Limitations
(Fill in with the team at the end of the sprint.)
