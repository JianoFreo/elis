# Princess Products / Sales API Handover

All endpoints require the existing JWT authentication middleware. Sales staff are locked to their own selling branch. Owner sales queries must supply `branch_id`; product operations require owner or production-head role. Existing account and other module routes are retained.

| Method and path | Main fields / purpose |
| --- | --- |
| `POST /api/production/products` | `name`, `description?`, `price`, `cost`, `threshold?`; validated product registration |
| `PATCH /api/production/products/:code` | Partial name, description, price, cost, threshold, latest batch best-before; only owner may change active status |
| `GET /api/production/inventory` | Batch/location balances, hub/branch totals and location/product low-stock count |
| `GET /api/production/inventory/:code` | Product master, latest batch and recent ledger movements |
| `POST /api/production/production-output` | `product_code`, `batch_no`, `quantity`, `best_before?`, `request_ref?`; production reference comes from inserted batch ID |
| `POST /api/production/stock-baseline` | `product_code`, `batch_no`, `branch_id`, `quantity`, `reference`, `entry_type` (`opening` or `received`) |
| `GET /api/sales/workspace` | Current branch day, stock positions, current-day sales, closing and recent records |
| `POST /api/sales/sales` | `product_code`, `quantity`, `local_ref?`, `sold_at?`, `offline?`; normal device sync uses `offline:false` |
| `GET /api/sales/queue` | Legacy/server-pending rows for the branch; device-only entries remain local until uploaded |
| `POST /api/sales/sync` | Promotes existing server-pending rows once; returns `synced`, `failed`, `total` |
| `GET /api/sales/sales?date=YYYY-MM-DD` | Branch sales on the requested Philippine date |
| `GET /api/sales/closing/count` | Product count form and any existing current-day closing |
| `POST /api/sales/closing` | `counts:[{product_code,physical}]`, `note`; every active product once, explanation for variances |
| `GET /api/sales/summary?date=YYYY-MM-DD` | Historical day positions / frozen submitted count snapshot |
| `GET /api/owner/audits/:code/baseline?branch_id=N` | Signed week's final confirmed physical closing snapshot |
| `POST /api/owner/audits/:code/baseline` | `branch_id`; zero-quantity carry-forward marker and saved snapshot, idempotent on retry |

Legacy owner product create/edit URLs delegate to the same validated product handlers. Owner account functions and Jiano's dispatch/receipt/material/reconciliation logic are not replaced.

## Reference and transaction rules

- `local_ref` is at most 40 characters. The frontend's generated UUID references fit that limit. The server also generates one for older callers that omit it, but clients need to retain and reuse a reference to get network-retry protection.
- The same sale reference must retain its branch, user, product, quantity and supplied original capture timestamp. A confirmed replay returns the prior transaction; a different payload using that reference returns 409.
- Offline capture uses cached estimates. The server chooses the authoritative current product price when it confirms a new transaction; client-supplied price values cannot override it.
- `sold_at` includes a timezone. Future business dates are rejected; submitted closing days and signed weeks cannot accept new postings. With a BUSINESS_DATE override, new Princess-module writes align to that configured date.
- A queued row has no stock effect until confirmed. Each server queue row uses a transaction savepoint: a stock/period conflict preserves the row while other valid rows can sync.
- Sales consume available stock from actual branch batches in earliest-best-before order. Advisory locks are requested before product stock checks. Hosted multi-session concurrency still needs team integration testing; isolated tests serialize the embedded DB connection.
- Stock request references are at most 60 characters. `product_stock_requests` stores normalized payloads and results in the same transaction as production / external-stock writes. Repeating the same reference returns its original response; changed contents reject.
- Initial opening is for an empty product/location ledger, not an increment to an existing opening. External received stock is a separate movement. The separate dispatch receipt flow is the only path for hub-to-branch delivery credits.
- Closing creates discrepancy records; it never directly adjusts stock. Source count values stay frozen after later approved adjustments.
- Next opening is taken from the signed week's final confirmed closing, not the live stock sum. It adds zero quantities and saves the carried values in the request/activity metadata.

## Schema integration

`TABLES` gains only `product_stock_requests`. Two unique indexes enforce one closing per branch/day and one count row per closing/product. The table is created on normal boot. The existing explicit `seed:reset` command also clears the new request markers, so a wiped ledger cannot retain stale retry results. No actual database reset is performed by this deliverable.

The exported schema constants are reused by isolated test fixtures. The test adapter substitutes only the database transport with PGlite; application handlers, auth/role guards, SQL and transaction logic run unchanged.
