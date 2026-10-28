# Testing

All tests use **synthetic data** on **local** databases. Nothing here connects to Neon, Vercel or the plastic system.
`tests/e2e/run-all.sh` refuses to run unless its database URL is on `localhost`.

## How to run

```bash
npm run typecheck && npm test           # TypeScript + unit tests (Vitest)
npm run build                           # e2e suites run against a production build
bash tests/e2e/run-all.sh               # every suite, each on a FRESH local database `dairy_accept`, server on :3001
bash tests/e2e/run-all.sh dairy         # one suite
DATABASE_URL=… npx tsx scripts/check-integrity.ts   # read-only ledger check
```

Needs PostgreSQL running locally with role `dairy` / password `dairy_dev` (test-only credentials), Python 3 and Playwright.
`tests/e2e/reset-dairy-db.sh` drops and recreates `dairy_accept` and applies the migrations.

## Suites

| Suite | File | What it proves |
|---|---|---|
| Unit | `tests/unit/dairy.test.ts`, `cost.test.ts`, `money.test.ts`, `num-words.test.ts` | Recipe maths per batch / piece / carton, kg ↔ g ↔ mg rounding (6 decimals), loss, cartons + loose pieces, product cost and FIFO take, money rounding |
| Dairy acceptance | `tests/e2e/dairy.py` | From an empty database: setup and roles (no QC/service); items in kg/pcs (litres refused); batch recipe; opening stock by the warehouse; **strict production** (100 pcs refused with only 80 containers — the container named, nothing saved); 1 batch → 80 pcs saved with loss 20; grams and 0.4 g culture; 1.5 batches; cartons rounded up; two products together short → whole save refused; **two simultaneous saves**, only one succeeds; same submission ×3 applied once; corrections up/down; Output and Sale refused beyond stock; older purchase / production can't be edited below what was used or sold; whole ledger never below zero; FIFO lots with IQD and USD; daily in/out report (opening + in − out = closing; filters by paper number, employee, direction, section); warehouse sees no money anywhere; accountant sees values; removed modules gone; refusal shown on screen |
| FIFO | `tests/e2e/dairy-fifo.py` | Exact figures: milk at 600 then 700 IQD (USD × rate), 1.5 batches → 300 pcs = 110,000 IQD (366.67 / pc), stock value 180,000, after selling 100 → 73,333.33, purchase edited to 650 → run re-costed to 115,000 |
| Security | `tests/e2e/security.py` | See SECURITY.md |
| Money visibility & temporary passwords | `tests/e2e/m3-m4.py` | Warehouse sees no prices, also not in page data; temporary-password admin refused |
| Stock documents | `tests/e2e/stock-docs.py` | Input/Output/Buy/Sell numbering, reasons per direction, refusals, below-zero refused, permissions, reports, search, audit, Arabic, phone |
| Customers | `tests/e2e/customers.py` | Codes, discounts, invoice numbers, balances, statements |
| Safe / Safes | `tests/e2e/safe.py`, `safes.py` | Money in/out per currency, exchange, transfers, limits, permissions |
| Receipts | `tests/e2e/receipts.py` | Layouts, print view (black only), permissions |
| Review fixes | `tests/e2e/review-fixes.py` | Password change keeps this device, signs out others; deleted record message |
| Stage 1 | `tests/e2e/stage1.py` | Sign-in, forced password change, employees, languages, install banner |

Removed with the plastic modules: machines/molds, QC, technical service, label/workbook import, bulk import, plastic acceptance suites.
`tests/e2e/push.py` remains from the base system but was not re-run (it needs a test certificate; see its header).

## Latest results (28 Oct 2026, local PostgreSQL 16, production build)

| Suite | Result |
|---|---|
| Unit | **35/35** |
| dairy | **90/90** |
| security | **28/28** |
| fifo | **8/8** |
| m3-m4 | **29/29** |
| stock-docs | **37/37** |
| customers | **30/30** |
| safe | **42/42** |
| safes | **42/42** |
| receipts | **29/29** |
| review-fixes | **6/6** |
| stage1 | **14/14** |
| Integrity check after the suites | no inconsistencies |
| Backup drill | dump → AES-256 encrypt → decrypt → restore into an empty database: 26 tables, identical row counts, integrity check clean on the copy |
| TypeScript | no errors |
| `npm audit --omit=dev` | 0 vulnerabilities |

Not tested: real Neon/Vercel/Blob (nothing deployed), push notifications, real devices (phones were emulated by Playwright), Arabic/Turkish wording quality.
