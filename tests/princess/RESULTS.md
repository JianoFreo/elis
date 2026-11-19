# Princess Regression Results

Date: 19 Nov 2026. Runtime: Node.js 24.22.3. Scope: Princess module APIs and device queue storage.

## Verified commands

| Command | Result |
| --- | --- |
| `npm --prefix frontend run build` | Passed: TypeScript + Vite production output |
| `npm --prefix backend run test:princess` | Passed: backend TypeScript build + 28 tests, 0 failed |
| `npm --prefix frontend run test:princess:ui` | Passed: 14 Playwright checks in headless Microsoft Edge |

## Recorded checks

| # | Test | Result |
| --- | --- | --- |
| 01 | authentication and role guards protect Princess APIs | Passed |
| 02 | product registration validates money and supports production-head creation | Passed |
| 03 | product master rejects negative values and clears description and latest batch date atomically | Passed |
| 04 | production retries reuse one ledger credit and generated reference | Passed |
| 05 | baseline is initial-only; external receipts and retries have distinct safe semantics | Passed |
| 06 | stock and numeric validation rejects overselling without partial rows | Passed |
| 07 | sales consume the branch batches earliest-best-before first | Passed |
| 08 | online retries return the same sale and conflicting references are rejected | Passed |
| 09 | server queued sales do not affect stock; partial sync retains failed records | Passed |
| 10 | the same queued reference promotes to a confirmed sale exactly once | Passed |
| 11 | closing rejects duplicate products, missing products and blank physical counts | Passed |
| 12 | pending sales block closing; submitting does not adjust stock | Passed |
| 13 | historical summary ignores later stock movements | Passed |
| 14 | submitted expected and variance remain frozen after owner adjustments | Passed |
| 15 | business date override aligns new sale, ledger and daily summary | Passed |
| 16 | staff cannot switch branches; owner queries require explicit branch selection | Passed |
| 17 | signed next opening uses final confirmed closing, never the current live ledger | Passed |
| 18 | sales belonging to a signed week cannot post or synchronize | Passed |
| 19 | activity failure rolls back the sale and its stock movements together | Passed |
| 20 | fully sold stock remains visible as a zero-stock alert | Passed |
| 21 | legacy owner product URLs share the same validation without changing account actions | Passed |
| 22 | offline entries survive new reads and stay isolated by user and branch | Passed |
| 23 | queue references fit the server limit and are unique | Passed |
| 24 | enqueue retry is idempotent; conflicting contents are rejected | Passed |
| 25 | failure retains exact sale and original timestamp for a safe replay | Passed |
| 26 | unavailable device storage never reports that the sale was queued | Passed |
| 27 | corrupt data is reported and never silently erased | Passed |
| 28 | invalid local quantities are rejected before writing | Passed |

## Verification boundary

The 21 API checks exercise actual Express endpoints, JWT/role middleware, SQL statements and transaction logic through an isolated PostgreSQL WASM (PGlite) transport adapter. The 7 queue tests exercise local persistence / validation with an isolated Storage implementation. A fresh fixture is loaded for each API test. No real Neon credentials, live production data or external database were used.

A deliberate activity-log insertion failure is injected by one test to prove that the sale and ledger roll back together. Its expected error output does not represent a failing test.

The embedded adapter serializes transactions; hosted multi-session races and production load have not been tested. The app requests advisory locks and has unique constraints, but this suite alone does not prove performance or concurrency behavior on a live Neon deployment.

## Browser verification

The Playwright run used the isolated application and database. It covered sign-in, offline capture, synchronization and reload, daily closing, the sales summary layout, production output, external stock receipt, product registration and editing, product detail at 390 px, and owner next-opening confirmation from a signed snapshot.

The live Neon read-only check confirmed the assigned-module tables and both closing uniqueness indexes. Seven authenticated GET requests returned HTTP 200 across inventory, audits, the sales workspace, sales history, queue, closing counts, and daily summary. Live write verification, full teammate-module acceptance, professor/business-owner approval, and deployment remain open.
