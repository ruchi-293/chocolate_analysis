# ChocoAnalytics — Backend API

Node.js / Express / MongoDB backend for the ChocoAnalytics chocolate
manufacturing analytics platform. Provides JWT auth with role-based access
(public guest, registered user, admin), dataset management (CRUD + CSV
import + CSV/Excel/PDF export), and analytics endpoints for every chart on
the frontend dashboards — all backed by real MongoDB collections.

## Stack
- **Express 4** — REST API
- **MongoDB + Mongoose 8** — data store
- **JWT + bcrypt** — authentication & password hashing
- **Multer + csv-parser + exceljs + pdfjs-dist** — CSV/Excel/PDF dataset import
- **json2csv / exceljs / pdfkit** — CSV / Excel / PDF export
- **nodemailer** — verification & password-reset emails
- **helmet, cors, express-rate-limit, morgan** — security & logging

## Exact commands to run the whole project

```bash
# 1. Backend
cd choco-backend
npm install
cp .env.example .env
# edit .env — at minimum set MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET,
# SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
npm run seed     # populates MongoDB with products, factories, metrics, and creates your admin account
npm run dev      # starts the API on http://localhost:5000

# 2. Frontend
# Just open choco-analytics.html in a browser — no build step.
# It talks to http://localhost:5000/api by default (see API_BASE near the
# top of the <script> tag in the HTML file if you need to change it).
```

You now have: a running API on port 5000, a seeded MongoDB database, and a
frontend that's already wired to it.

## 1. Install

```bash
cd choco-backend
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — a local `mongodb://127.0.0.1:27017/chocoanalytics`, or a free
  [MongoDB Atlas](https://www.mongodb.com/atlas) connection string.
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — any long random strings.
- `ALLOWED_ORIGINS` — comma-separated list of frontend origins allowed to
  call the API (CORS). Defaults already cover common local dev ports
  (5173, 3000, 5500) and a frontend opened directly as a `file://` page, so
  you usually don't need to touch this for local development.
- `SMTP_*` — optional for now; signup/login still work without email
  configured, verification/reset emails just won't send (a warning is
  logged instead of failing the request).
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the first admin account.
  **The server creates this account automatically on boot if no admin
  exists yet** (see `utils/seedAdmin.js`) — you don't have to run the seed
  script just to get an admin login, though seeding is still the easiest
  way to also get sample data.

## Seeding the database

Seeding is **fully offline** — it reads CSVs bundled in `seed/data/`
(factories, products, employees, production, sales, inventory, orders) and
imports them directly. There is no dependency on any external API, and each
step is independently error-handled: if one dataset fails to import for any
reason, the rest still seed normally and you'll see exactly which step
failed and why in the console output.

```bash
npm run seed
```

This populates:
- **30 factories** across 22 countries
- **1,500 products** (12 chocolate varieties, 26 brands)
- **500 employees** across 10 roles
- **3,000 daily production records** (backs the Production Trend / Production
  by Line charts and the Daily/Weekly/Monthly/Yearly Output KPI cards with
  real aggregated numbers instead of placeholders)
- **3,000 sales transactions**
- **1,200 inventory snapshots**
- **2,000 orders** (order ID, customer, product, quantity, date, delivery
  status, revenue)
- 12 months of sustainability/market metrics, regional sales, and your first
  admin account

Every dataset was validated before being bundled: zero nulls, zero empty
fields, zero zero-values in economically important numeric columns
(revenue, quantity, production units, salary, stock, capacity), zero
duplicate IDs, and full referential integrity (every order/sale/inventory
row references a product that actually exists in `products.csv`; every
production record references a factory that actually exists in
`factories.csv`).

Seeding is idempotent — re-running `npm run seed` skips any collection that
already has data, so it's safe to run repeatedly.

### Regenerating or replacing the datasets

The CSVs in `seed/data/` are static bundled files, not generated at seed
time. To regenerate them or plug in your own data, replace the files in
that folder (keeping the same column headers) and clear the relevant
MongoDB collection before re-running `npm run seed`.


## 4. Run the API

```bash
npm run dev     # with nodemon, auto-restart
# or
npm start
```

API runs at `http://localhost:5000/api`. Health check: `GET /api/health`.
On every boot, the server also checks for an admin account and creates one
from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` if none exists yet.

## API overview

| Area | Route prefix | Access |
|---|---|---|
| Auth | `/api/auth` | signup, login, admin-login, forgot/reset password, verify-email |
| Dataset | `/api/products` | GET public · POST/PUT/DELETE admin only · `/import` admin (CSV/XLSX/PDF) · `/export/csv\|excel\|pdf` logged-in |
| Analytics | `/api/analytics` | overview/sales/regional public · inventory/forecast logged-in only |
| Metrics | `/api/metrics` | production-trend, production-by-factory, sustainability-trend, market-trend, regional — all public, back the public dashboard charts |
| Users | `/api/users` | self-service favorites/notifications · admin user management |
| Factories | `/api/factories` | GET public · write admin only |
| Orders | `/api/orders` | GET logged-in · write admin only |
| Suppliers | `/api/suppliers` | admin only |
| Activity Logs | `/api/activity-logs` | admin only |
| Employees | `/api/employees` | admin only |
| Production Records | `/api/production` | GET public (backs Production charts) · write admin |
| Sales Transactions | `/api/sales` | logged-in read · write admin |
| Inventory Snapshots | `/api/inventory` | logged-in read · write admin |

All protected routes expect `Authorization: Bearer <token>` from `/api/auth/login`.

## Notes on data source

`Product.sourceApi` marks where each dataset record came from: `csv-seed`
(the bundled `seed/data/products.csv`), `manual` (added via the admin
panel), `csv-import`/`xlsx-import`/`pdf-import` (uploaded via the admin
dataset page). The OpenFoodFacts API is no longer used for automatic
seeding — it was a live network dependency with no fault isolation, so a
single failed request there used to silently prevent every other
collection (factories, production records, orders, etc.) from seeding at
all. Seeding is now fully offline and CSV-driven for reliability; OpenFoodFacts
is still usable as one of several file formats an admin can manually
import via the Dataset Management page if you want to supplement the data.

`MonthlyMetric` and `RegionalSales` hold the sustainability/market/regional
figures behind the public dashboard's Sustainability, Market, and Regional
charts. `ProductionRecord` (daily, per factory) backs the Production Trend
and Production by Line charts and the Output KPI cards with real
aggregated data — edit any collection directly in the database and the
dashboard reflects the change on next load.

## Dataset import (CSV / Excel / PDF)

`POST /api/products/import` (admin only, multipart field `file`) accepts `.csv`,
`.xlsx`/`.xls`, or `.pdf` and auto-detects which one it's looking at from the
filename. The old `/api/products/import-csv` path still works as an alias.

**Column matching is header-name-flexible**, not hardcoded to one exact
spelling. `utils/columnMapper.js` normalizes headers (case, spaces,
underscores all ignored) and matches them against a synonym table, so a file
with `ProductName`, `RevenuePerMonthUSD`, `UnitsProducedPerMonth`, etc.
(e.g. the generated ChocoAnalytics dataset) imports correctly, as does a
plainer file using `product_name`, `revenue`, `units`. Recognized columns
cover the full 29-field dataset schema (cocoa %, sustainability score,
carbon footprint, production/expiry dates, and so on) — anything the mapper
doesn't recognize is simply ignored rather than causing the row to fail.

**Every row is validated individually** before insert. The response reports
exactly what happened:
```json
{
  "success": true,
  "message": "Imported 3198 of 3200 rows — 2 skipped (see details).",
  "count": 3198,
  "totalRows": 3200,
  "skipped": 2,
  "errors": [{ "row": 45, "reason": "productName: Path `productName` is required." }]
}
```
No more silent "Imported 0 records" — if rows fail, you can see exactly which
row and why.

**PDF import — honest limitation:** PDF has no native concept of a "table,"
only text positioned at coordinates. The importer (`utils/fileParsers.js`,
built on `pdfjs-dist` directly rather than the abandoned `pdf-parse` package)
reconstructs rows by grouping text at the same vertical position and
detecting column gaps, then looks for a header row it recognizes. This works
reliably for PDFs with genuine tabular structure — e.g. exported from Excel,
or built with a real `Table` object in a PDF-generation library — which is
the realistic case for "an admin exports data as PDF and re-imports it."
It does **not** reliably parse arbitrarily laid-out PDFs (multi-column
brochures, wrapped paragraph-style table cells, scanned images). If it can't
find a recognizable table, it returns a clear error rather than importing
garbage. For guaranteed results, use CSV or XLSX.

## CORS

Configured in `server.js` via a dynamic origin check rather than a single
static value, because a single value can't simultaneously satisfy "serve the
frontend from a dev server" and "open the frontend HTML file directly." It
allows:
- No `Origin` header (curl, Postman, mobile clients)
- `Origin: null` (a frontend HTML file opened via `file://`)
- Anything listed in `ALLOWED_ORIGINS` (or `CLIENT_URL` as a fallback)
- A few common local dev ports by default (5173, 3000, 5500)

Everything else is rejected. If your frontend runs somewhere else, add it to
`ALLOWED_ORIGINS` in `.env`.

## Connecting the frontend

`choco-analytics.html` is already wired to these endpoints:
- Login/signup/admin-login/forgot-password → `/api/auth/*`
- Public Analysis Dashboard charts → `/api/metrics/*` and `/api/analytics/*`
- My Dashboard (registered user) → `/api/analytics/inventory-status`,
  `/api/analytics/factory-performance`, `/api/analytics/demand-forecast`,
  `/api/users/notifications`
- Admin Console dataset table → full CRUD + CSV import + CSV/Excel/PDF
  export against `/api/products/*`
- Admin Console Factories/Orders/Suppliers/Users/Activity Logs → read views
  against their respective `/api/*` routes

The API base URL is a single constant near the top of the frontend's
`<script>` tag: `const API_BASE = 'http://localhost:5000/api';` — change
this if you deploy the API somewhere other than localhost.

