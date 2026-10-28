# Bereket Dairy Factory Management System — Project Report & Handoff

> Written 28 Oct 2026 for another AI assistant (or developer) to pick up this project with full context.
> The source code is in the accompanying zip (`bereket-dairy-source.zip`, the Git repository `Farhad800/bereket-dairy`, branch `main`).
> No passwords, connection strings or tokens are included anywhere in this report or the zip.

---

## 1. What this is

A web application (installable on phones as a PWA) that runs the **Bereket Dairy** factory in Duhok, Iraq: yoghurt, ayran (شنينة), cream cheese, qashta, cheddar, mozzarella and other cheeses under several brands (Bereket, Derya, Rahma, Tamdar, Hema, Gara, Heba, Berry Farm, Nawar…).

It covers: sales orders → daily production by **batches** → a warehouse with three sections → stock movements (Input / Output / Buy / Sell) with FIFO costing → customers & balances → safes (cash in IQD/USD/EUR) → printed receipts → reports, audit log, notifications.

It was adapted on 28 Oct 2026 from a sister system, **Bereket Plastic FMS** (repo `Farhad800/berecket`, Vercel project `bereket-fms`). The two are completely separate: separate repo, Vercel project, Neon database and file store. **Never connect one to the other's database.**

| | |
|---|---|
| Live URL | https://bereket-dairy.vercel.app |
| GitHub | `Farhad800/bereket-dairy` (public today — should be made private) |
| Vercel | project `bereket-dairy` (id `prj_p6iB5dMpoS5RihystkdR2dxPRT3u`), Hobby plan, **functions region iad1** |
| Database | Neon PostgreSQL (Vercel Marketplace store `bereket-dairy`), **region iad1 (Washington)**, Free plan |
| Files | Vercel Blob store `bereket-dairy-files`, **private**, fra1 |
| Languages | English, Arabic (RTL), Turkish — Arabic/Turkish machine-drafted, need native review |
| Design | Black & white only, the supplied Bereket logo unaltered (`public/brand/bereket-dairy-logo.jpg`) |
| Owner's rule | Host on **Vercel only**. Nothing is deployed without the owner's explicit go-ahead. |

---

## 2. Tech stack

- **Next.js 15.5** (App Router, React 19, Server Components, **server actions** for all writes), TypeScript.
- **Prisma 6.19** + PostgreSQL. Migrations in `prisma/migrations/` (applied on production builds by `scripts/db-deploy.mjs`; preview builds skip them).
- **Tailwind CSS v4**, `lucide-react` icons, own UI kit in `src/components/ui.tsx`.
- **next-intl 4** — messages in `messages/en.json`, `ar.json`, `tr.json` (same keys in all three).
- **Auth:** own sessions (random token in httpOnly cookie, only its SHA-256 stored), bcrypt cost 12, lockout after 5 failures, forced password change for temporary passwords.
- **Files:** `@vercel/blob` (private) in production, `./.uploads` locally.
- **Tests:** Vitest unit tests (`tests/unit`), Python Playwright end-to-end suites (`tests/e2e`, run by `tests/e2e/run-all.sh` on a throw-away local database `dairy_accept`).
- **PWA:** manifest, icons generated from the logo (`scripts/make-icons.mjs`), service worker caching only static files + offline page.

Build command on Vercel: `npm run vercel-build` = make-icons → prisma generate → db-deploy (migrate + idempotent seed, production only) → next build.

---

## 3. Folder map

```
prisma/schema.prisma            data model (see §5)
prisma/migrations/              20261028120000_dairy_init · …120100_dairy_base_data · …180000_material_group
prisma/seed.ts                  roles, departments, settings (idempotent); optional first admin
src/middleware.ts               cookie check → /login (real checks happen server-side)
src/app/(app)/…                 signed-in pages: dashboard, orders, production, inventory (warehouse),
                                stock (movements), products, customers, cash (safe), receipts, reports,
                                notifications, search, admin, audit, employees
src/app/actions/*.ts            server actions (every write; each checks a permission on the server)
src/app/api/…                   health, files (permission-checked downloads), reports CSV, audit export
src/lib/auth.ts                 sessions, getCurrentUser, can(), canSeeMoney(), requirePermission()
src/lib/permissions.ts          permission catalogue, default roles, MONEY RULE (effectivePermissions)
src/lib/stock.ts                stock guard: getStock, lockItems, requireStock, neverNegative
src/lib/recipe-math.ts          batch / piece / carton maths, loss, cartons+loose pieces, kg/g/mg formatting
src/lib/consumption.ts          what a production entry takes from stock
src/lib/fifo.ts                 FIFO lots & costing (purchases at own price/rate, production run cost)
src/lib/product-costs.ts, cost.ts   recipe cost per piece / per run
src/lib/sections.ts             warehouse sections: PRODUCT · RAW · PACKAGING
src/lib/opening-import.ts       one-time opening stock import (CSV) + src/lib/csv.ts parser
src/lib/reports/                report registry (production, consumption, orders, demand, warehouse-daily, trade, cash)
src/lib/data-reset.ts, scripts/go-live.ts   clear test data before go-live
scripts/check-integrity.ts      READ-ONLY ledger check (never below zero, production = movements)
docs/                           README-level guides: DEPLOYMENT, OPERATIONS, BACKUP-RESTORE, SECURITY, TESTING, USER-GUIDE, DAIRY-ADAPTATION
.github/workflows/backup.yml    nightly encrypted pg_dump + Blob files (needs repo secrets)
tests/unit, tests/e2e           see §9
```

---

## 4. Business rules (the important part)

### Units
- Finished products are counted in **pieces** (a cup, a bowl, a bottle). Optional **pieces per carton**; stock is then also shown as "N cartons + M pcs".
- Raw materials in **kg** (milk always kg; can be typed in g; stored with 6 decimals = **1 mg** precision) or **pieces**.
- Packaging in pieces (cups, lids, labels, cartons) or kg (film, rolls, nylon).

### Recipes (per product)
- **Ingredients per batch** (milk 100 kg, sugar 5 kg, culture 0.4 g…), **packaging per piece** (1 cup, 1 lid, 1 label), **items per carton** (1 carton, tape…) — `ComponentBasis = BATCH | PIECE | CARTON`.
- **Pieces expected from one batch** (`batchYield`) → used for loss.
- A recipe may only use ingredients/production items, never a finished product.
- **Production entry is locked for a product until it has a batch recipe** (the daily sheet shows an "Add recipe" button on locked rows).

### Production (one shift; the day = factory calendar day, Asia/Baghdad)
- Per product: **batches** (3 decimals) and **pieces produced**.
- Use = batches × per-batch ingredients + pieces × per-piece packaging + ⌈pieces ÷ pieces-per-carton⌉ × per-carton items.
- **Loss** = batches × pieces-per-batch − pieces produced (live on the sheet, stored with the entry, in reports).
- A sheet with several products saves **all or nothing**.

### Stock is never below zero — at any moment
- Every stock-changing save runs in **one transaction**: lock the affected item rows (`SELECT … FOR UPDATE`, sorted ids → no deadlocks) → check → write → `neverNegative()` re-checks the running balance (also for edits to older documents, from that document's time on).
- Refusal message names every short item: `Production: not enough stock. Nothing was saved. • CONT Container — needs 100, in stock 80, short 20`.
- **Idempotent:** every form submission carries a `submissionId` (`SubmissionKey` table) — a double press or retry is applied once.

### Warehouse (three sections, `src/lib/sections.ts`)
- **Finished products** (`kind = PRODUCT`), **Raw materials** (`kind = MATERIAL, materialGroup = RAW`), **Packaging** (`kind = MATERIAL, materialGroup = PACKAGING`).
- **Input** reasons: opening stock, return, transfer in, count correction, other. **Output** reasons: return, transfer out, count correction, damage, expired, sample, other. Each with source/destination, paper number, note, scanned papers.
- **Buy / Sell** are the accountant's money documents (prices, currency + rate, discounts, invoice numbers, payments into/out of a safe).
- **Daily in/out report:** per item (opening + in − out = closing) or per movement; filters: date, section, item, direction, employee, paper number; CSV.

### FIFO costing
- Every Buy (and Input with a price) is a lot at its own price and rate (USD/EUR × the rate typed that day → IQD). Input without a price uses the item's set cost.
- Production takes the oldest lots first; a production run's real cost = cost of the lots it used; products then become lots at that cost; sales take product lots FIFO.

### Money rule (owner, 28 Oct 2026) — `src/lib/permissions.ts`
- **Money is visible only to roles with `cash:view` (Safe → View).** That means prices, costs, stock values, totals, payments, balances, phones on receipts, money reports, CSV money columns, money in notifications.
- A role without `cash:view` loses — on the server, whatever is ticked — `stock:buy`, `stock:sell`, all other `cash:*`, `customers:*`, `receipts:manage` (`effectivePermissions()` in `getCurrentUser`). The role editor greys those boxes out and explains why.
- Money is removed from the **page data itself**, not just hidden.

### Roles (defaults; editable in Administration → Roles & permissions)
| Role | Can |
|---|---|
| Administrator | everything |
| Accountant | buy, sell, input, output, customers, safe, receipts, products & costs, exports, audit view — sees money |
| Sales Manager | orders (create/edit/approve/archive), reports — no money |
| Production Team | production entries & corrections — no money |
| Warehouse Team | Input & Output documents, warehouse/report exports (quantities only) — no money |

Everyone active can *view* orders, production, warehouse, stock movements, products, reports, employee list.

---

## 5. Data model (Prisma, main tables)

- **User, Role, RolePermission, Department, Session, AuditLog, Setting, Counter** (document numbering), **SubmissionKey** (idempotency), **Notification, PushSubscription, Comment, Attachment** (scanned papers on stock documents).
- **Product** — one table for all items: `kind PRODUCT|MATERIAL`, `materialGroup RAW|PACKAGING` (materials only), `unit pcs|kg`, `piecesPerCarton`, `batchYield`, cost fields (`costPrice`, `costCurrency`, `costRate`, `costIqd`), `archivedAt`.
- **ProductComponent** — recipe line: `productId`, `componentId`, `qty Decimal(18,6)`, `per BATCH|PIECE|CARTON`.
- **ProductionEntry** — `day`, `productId`, `batches Decimal(12,3)`, `quantity Int`, `expectedPerBatch`, notes.
- **StockDoc** — `number` (IN-2026-0001, OUT-…, BUY-…, SAL-…), `type INPUT|OUTPUT|BUY|SELL`, reason, reference (paper no.), party, customer, currency, rate, invoice numbers, discounts, totals.
- **StockMovement** — the ledger: `productId`, `type PRODUCTION|USE|INPUT|OUTPUT|BUY|SELL`, signed `qty Decimal(18,6)`, `entryId` or `docId`, `unitPrice`, discounts, `createdAt`. **Stock = SUM(qty).**
- **Order, OrderLine** (sales order sheets), **Customer** (codes C-0001, balances), **Safe, CashEntry, ExpenseCategory** (money in/out/exchange/transfer), **ReceiptLayout**.

Removed from the plastic system: machines, molds, technical service, QC, shifts, labels-as-kind, Excel item workbook.

---

## 6. Current state (28 Oct 2026, evening)

- **Live** at https://bereket-dairy.vercel.app; the first administrator exists (the setup page is closed).
- Owner's stock list (`feroo.xls`, 521 items) was sorted into **179 finished products, 44 raw materials, 298 packaging items**, converted (cartons × pieces per carton; grams → kg; last purchase price → item cost) into `bereket-dairy-opening-stock.csv`. The owner loads it once in **Administration → System → Load opening stock** (Check file → Load stock). Assumptions flagged to the owner: item 254 = 6 pcs/carton; item 149 counted as cartons although its unit said pieces.
- **No product has a batch recipe yet** → the production sheet is locked until recipes are entered.
- Performance: the app's functions were moved from fra1 to **iad1** (same region as the Neon DB). Pages went from 0.6–1.7 s server time to ~0.02–0.2 s. Neon Free plan suspends after ~5 min idle → first click ~1 s.

---

## 7. Open items / recommendations

1. Make the GitHub repo **private**. The plastic repo's `PROGRESS.md` contains an admin password — change it and purge it from history.
2. Mark the dairy Vercel env vars **Sensitive**; scope DB variables so preview deployments don't use the production database.
3. Vercel **Pro** before real commercial use (Hobby = non-commercial); Neon paid plan for a longer restore window and no idle suspend.
4. Optional: move to a **Frankfurt (fra1) database + fra1 functions** (fastest for Iraq) — needs a new Neon DB and a data copy; easiest while data is small.
5. **FIFO snapshot/caching** before the ledger grows large (fifo.ts re-reads the whole movement history on money pages).
6. Arabic/Turkish text review by native speakers.
7. Ideas raised: alert when a production run's loss is above X %; lot/expiry tracking for ingredients; a dairy-specific bulk item import.
8. Nightly backup workflow (`.github/workflows/backup.yml`) needs repo secrets `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `BACKUP_PASSPHRASE`.

---

## 8. How to run locally

```bash
npm install
cp .env.example .env                 # point at a LOCAL PostgreSQL (never the live DB)
npm run db:deploy                    # apply migrations
ADMIN_USERNAME=admin npm run db:seed # prints a one-time temporary admin password
npm run dev                          # http://localhost:3000
npm run demo:add                     # optional demo users (password Demo12345!) + DEMO- items
```

Environment variables (values are NOT in the repo): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `FACTORY_TIMEZONE=Asia/Baghdad`, `SETUP_TOKEN` (first admin only), optional `VAPID_*` (web push), `FIFO_START`.

---

## 9. Tests (latest run 28 Oct 2026, all green)

| Suite | Result |
|---|---|
| Unit (Vitest) | 38/38 |
| dairy (acceptance: recipes, strict stock, concurrency, idempotency, FIFO, warehouse report, money hiding) | 90/90 |
| security | 28/28 |
| fifo (exact cost figures) | 8/8 |
| m3-m4 (money visibility incl. the Safe-view rule, temporary passwords) | 32/32 |
| stock-docs | 37/37 |
| customers | 30/30 |
| safe / safes | 42/42 · 42/42 |
| receipts | 29/29 |
| review-fixes | 6/6 |
| stage1 (sign-in, roles, languages) | 14/14 |
| Read-only integrity check | no inconsistencies |
| Backup drill (dump → encrypt → decrypt → restore) | identical row counts |

Passing tests are evidence, not a guarantee; see `docs/SECURITY.md` → Known limits.

---

## 10. Rules for whoever continues

- Keep **dairy and plastic separate** (repos, Vercel projects, databases, Blob stores).
- **Never touch the live database for tests**; use a local DB. `run-all.sh` refuses non-localhost URLs.
- **Don't deploy without the owner's explicit approval.** Hosting is Vercel only.
- Every write goes through a server action that checks a permission on the server; stock writes must use `lockItems` → `requireStock` → write → `neverNegative` inside one transaction.
- Money: use `canSeeMoney(user)` (= `cash:view`) and leave money out of page data for everyone else.
- Keep the three languages in sync (same keys in `messages/*.json`), black-and-white design, logo unaltered, PWA features intact.
- Keep the app's function region equal to the database region.
