# Run the completed project in Windows / VS Code

This repository is now **React + Vite + Express + TypeScript + Neon PostgreSQL**. It is not the older standalone `dist/index.html` demo. Both the frontend and backend must run. XAMPP/MySQL/SQLite are not used.

## 1. Open the complete extracted folder

Extract the downloaded ZIP. In VS Code choose **File → Open Folder**, then select the folder containing `backend`, `frontend`, `tests`, `management` and `package.json`.

Use Node.js 24 LTS (the version used for these checks). Open **Terminal → New Terminal** and verify:

```powershell
node --version
npm --version
```

Install the lockfile dependencies:

```powershell
npm --prefix backend ci
npm --prefix frontend ci
```

`node_modules` is intentionally not included in the ZIP. These commands install the exact locked dependencies for your computer.

## 2. Configure the existing Neon database

From the project root:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Open `backend/.env` and enter **your team's own Neon connection string** and a private JWT secret:

```dotenv
PORT=5000
DATABASE_URL=postgresql://YOUR_NEON_USER:YOUR_NEON_PASSWORD@YOUR_NEON_HOST/YOUR_DATABASE?sslmode=require
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
IS_PRODUCTION=false
BUSINESS_DATE=2026-11-08
```

Generate a random secret locally if needed:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In `frontend/.env`, keep the API URL empty when using Vite's existing proxy:

```dotenv
VITE_API_BASE_URL=
VITE_DEMO_ACCOUNTS=true
VITE_DEMO_PASSWORD=Eli2026!demo
```

The optional demo-password setting is for a school demonstration only; leave demo quick-fill disabled on a real public deployment.

Do not commit either `.env`. No real credentials are included in this download. `IS_PRODUCTION=false` keeps the inherited destructive schema synchronization disabled.

## 3. Start the API and initialize sample records

In terminal 1, from the root:

```powershell
npm --prefix backend run dev
```

In a second terminal, seed the existing starter data:

```powershell
npm --prefix backend run seed
```

Use the normal seed command, not `seed:reset`, on a database containing work you want to keep. New tables and indexes are created on backend startup. If a pre-existing database contains duplicate branch/day closings or duplicate product/count rows, startup will report the unique-index failure; have the database owner review those duplicates rather than deleting data automatically.

## 4. Start the frontend

In terminal 2, after seeding:

```powershell
npm --prefix frontend run dev
```

Open the localhost URL printed by Vite, normally `http://localhost:5173`.

### Seeded accounts

| Username | Role | Default seeded password |
| --- | --- | --- |
| `juan.delacruz` | Business Owner | `Eli2026!demo` |
| `ana.reyes` | Sales Staff — Main Street | `Eli2026!demo` |
| `paolo.garcia` | Sales Staff — Market Road | `Eli2026!demo` |
| `liza.mendoza` | Sales Staff — Town Center | `Eli2026!demo` |
| `marco.santos` | Production Head | `Eli2026!demo` |
| `rica.cruz` | Production Staff | `Eli2026!demo` |

If the team has changed a seeded user's password or used `SEED_PASSWORD`, use that password instead. Seeding does not overwrite existing account passwords.

## 5. Demonstrate Princess's flows

The seed history ends on 08 Nov 2026. Use `BUSINESS_DATE=2026-11-08` to view that sample day, or leave it empty for the real Philippine date. New Princess-module writes follow the configured business date consistently.

The historical **Main Street closing is already submitted**, and the inherited seed also includes two pending Main Street sales. The new guards intentionally refuse posting pending sales into a submitted/signed day. Do not bypass the guard or use `seed:reset` as a workaround on shared data. The team should review that inherited sample-data contradiction before final integration.

For a fresh sales/count/closing demonstration, leave **BUSINESS_DATE empty** to use the real current Philippine day and use **`liza.mendoza` / Town Center**, which has no inherited queued sales. Keep the historical date setting for reviewing the seeded snapshots. Confirm any incoming receipt before counting, record sales, synchronize device records, then close. Once a day is submitted, additional sales for that day are blocked; restart with a fresh business date and appropriate stock for another demonstration.

For offline capture:

1. Sign in online and open **Record a sale** once so the branch workspace is cached.
2. Keep that browser tab open. Disconnect, or choose **Keep on this device until connected**.
3. Save the sale and open **Offline queue**. This is not a server-confirmed sale yet.
4. Reconnect and click **Sync queued transactions**. Failed rows remain pending with a reason.
5. Synchronize all pending rows before closing. Never clear browser site data while records are pending.

The feature supports capture in an already-loaded, previously authenticated app. It does not provide first-time offline login or a service-worker/PWA installation. Cached prices/totals are estimates; the backend determines final price and stock at confirmation. Each device queue is isolated by user ID and branch. Always reopen the same browser and origin to recover a queue.

For products: sign in as `marco.santos` or the owner. Register a product, record production, and inspect its ledger. **Initial opening baseline** works only for a product/location with no ledger history. **External received stock** is an additional receipt, with its own reference. Deliveries from the main hub must use the dispatch receipt workflow instead.

For next opening: the owner must sign off the week first, with a confirmed closing on its final date. The carry-forward reads that closing's physical counts and records zero-quantity markers; it never credits the same stock twice.

## 6. Verify the code

From the root:

```powershell
npm --prefix frontend run build
npm --prefix backend run test:princess
```

The 28 tests use an isolated PostgreSQL WASM database. They do not connect to your Neon database. Node's experimental module-mocking warning is expected for this isolated test adapter.

To run the browser workflow checks from the repository root:

```powershell
npm.cmd --prefix frontend exec -- playwright install chromium
$env:VITE_API_BASE_URL = "/"
try {
    npm.cmd --prefix frontend run build
    if ($LASTEXITCODE -eq 0) {
        npm.cmd --prefix frontend run test:princess:ui
    }
} finally {
    Remove-Item Env:VITE_API_BASE_URL
}
```

The browser script uses the isolated test fixtures and serves the frontend and API on the same local origin. Build the backend first using the regression command above.

## 7. Save your work to GitHub

Use the team README's branch/PR workflow. In your existing repository, pull the current main branch, create a feature branch, then copy the completed project files into that checkout. Do not replace its `.git` folder or commit `.env` / `node_modules`.

```powershell
git switch main
git pull origin main
git switch -c feature/princess-products-sales
```

After copying the files and reviewing `git diff`, commit and push that feature branch for teammate review. This ZIP does not push or merge anything automatically.
