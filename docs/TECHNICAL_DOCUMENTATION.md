# Technical Documentation – Eli's Yummy Kitchen Inventory & Sales System

## 1. Overview
A web-based system that tracks sales, product stock, dispatches to branches, raw materials, discrepancies, weekly audits, staff accounts and reports for Eli's Yummy Kitchen.

## 2. Technology stack
| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Express + TypeScript API |
| Database | PostgreSQL (Neon) |
| Version control / CI | GitHub (branches, pull requests, GitHub Actions) |
| API testing | Postman |

## 3. Repository structure
| Folder | Contents | Owner |
|---|---|---|
| `frontend/` | React app: login, role shells, role pages | Developers |
| `backend/` | Express + TypeScript API on Postgres | Developers |
| `docs/` | Diagrams, user manual, technical docs | Documentation Specialist |
| `tests/` | Test plan, cases, results, bug log | Tester / QA |
| `management/` | Task board, sprint notes, progress reports | PM, Scrum Master |

## 4. Modules and ownership
| Developer | Modules | Backend files |
|---|---|---|
| John Michael Litana | Foundation, accounts and permissions, reports and CSV, deployment | `app.ts`, `routes/auth.route.ts`, `routes/owner.route.ts`, `config/db.ts` |
| Princess Ann Delos Reyes | Products, production, stock baseline, sales and daily closing (offline sync) | `routes/sales.route.ts`, `controllers/sales/` |
| Jiano Magtangob | Dispatch and receipts, materials and usage, discrepancies and weekly audits | `routes/production.route.ts`, `controllers/production/` |

## 5. System design (from Phase 2, Group 4)
Diagrams are in [`diagrams/`](diagrams/).

### 5.1 Data Flow Diagram
- **Context level:** one system (0) and five external entities: Owner (01), Sales Staff (02), Inventory Staff (03), Dispatch Staff (04), Supply Tracking Staff (05).
- **Expanded level:**

| Process | Sub-processes | Main actors |
|---|---|---|
| 1.0 Sales Transaction | 1.1 Log in and select shift, 1.2 Record sale, 1.3 Sync queued transactions, 1.4 Generate daily summary, 1.5 Owner review and weekly audit, 1.6 Submit daily closing | Sales Staff, Owner |
| 2.0 Inventory | 2.1 Establish stock baseline, 2.2 Record stock movement, 2.3 Daily physical count, 2.4 Reconcile stock | Production Head, Sales Staff, Owner |
| 3.0 Dispatch Logging | 3.1 Log dispatch details, 3.2 Confirm branch receipt, 3.3 Compare dispatched vs received and send alerts | Production Head, Inventory Staff, Owner |
| 4.0 Supply Tracking | 4.1 Manage supply master and thresholds, 4.2 Process stock-in, 4.3 Record daily opening and closing, 4.4 Compute usage and low-stock alert | Supply Tracking Staff, Owner |
| 5.0 Account Creation | 5.1 Create staff accounts, 5.2 Configure permissions, 5.3 Delete accounts | Owner |

- **Data stores:** D1 Sales Transactions, D2 Branch Inventory Ledger, D3 Daily Summary, D4 Offline Queue (local device), D5 Product Master, D6 User Accounts, D7 Discrepancy & Audit Records, D8 Main Hub Inventory, D9 Dispatch Logs.

### 5.2 Use cases
| Process | No. of use cases | Highlights |
|---|---|---|
| Sales Transaction | 11 | Record sale includes line total and stock movement; offline queue/sync extends record sale; flag discrepancy extends physical count |
| Dispatch Logging | 6 | Create dispatch includes deducting main hub stock; confirm receipt includes updating branch ledger; flag delivery discrepancy extends receipt |
| Supply Tracking | 7 | Closing inventory includes computing usage; low-stock alert extends closing |
| Inventory Process (To-Be) | 18 | Update Inventory Ledger is shared by production, dispatch, sale and adjustment; closing includes compare expected vs physical count |

### 5.3 ERD – entities and relationships
- An Account adds stock, records sales and dispatches supplies.
- Materials and Products go into the Centralized Inventory, which syncs with the branch Inventory Ledger.
- Dispatch Records feed the branch ledger.
- Sales Transactions and the ledger raise Discrepancy flags.
- The ledger and flags feed the Daily Sales Summary, compiled into Weekly Audits.

## 6. Data dictionary
Attribute names come from the ERD. **Data types and constraints must be confirmed with the developers** from `backend/src/config/db.ts` (marked `TBC`).

| Entity | Attribute | Data type | Notes |
|---|---|---|---|
| Accounts | accountId | TBC | Primary key |
| Accounts | username | TBC | |
| Accounts | password | TBC | Stored hashed (TBC) |
| Accounts | name | TBC | |
| Accounts | role | TBC | Owner / Sales Staff / Production Head / Production Staff |
| Materials | materialId | TBC | Primary key |
| Materials | name, description | TBC | |
| Materials | unit of measurement | TBC | |
| Materials | supplier/source | TBC | |
| Materials | date received | TBC | |
| Materials | unit cost | TBC | |
| Materials | low-stock threshold | TBC | |
| Product | productId | TBC | Primary key |
| Product | name, description | TBC | |
| Product | unit price | TBC | |
| Product | supply batch number | TBC | |
| Product | best before date | TBC | |
| Product | branch location | TBC | |
| Product | quantity | TBC | |
| Product | low-stock threshold | TBC | |
| Centralized Inventory / Inventory Ledger | name, branch, qty, best_before, supplies stock | TBC | |
| Sales Transactions | time, product, staff, qty | TBC | |
| Dispatch Records | date, batch number, products, qty, staff | TBC | |
| Daily Sales Summary / Weekly Audits | date, sales_qty, flags_number, flags_status, stocks_status | TBC | |
| Discrepancy | discrepancyid | TBC | Primary key |
| Discrepancy | expected quantity, variance, status | TBC | |

## 7. API endpoints
Route files (from the repo): `auth.route.ts`, `owner.route.ts`, `sales.route.ts`, `production.route.ts`.

| Method | Endpoint | Purpose | Request / Response |
|---|---|---|---|
| TBC | TBC | TBC | TBC (copy from route files or Postman) |

## 8. External API integration
Name of API, purpose, endpoint used, sample request/response, error handling: **TBC from developers** (required by the Phase 4 rubric).

## 9. Git workflow and commit format
1. Never commit directly to `main`.
2. One branch per task: `feature/<short-name>`, `docs/<short-name>`, `test/<short-name>`.
3. Commit small and often: `<type>: <what changed>` with type `feat`, `fix`, `docs`, `test`, `chore`.
4. Open a pull request, get one teammate's review, then merge.
5. Pull the latest `main` before new work.
