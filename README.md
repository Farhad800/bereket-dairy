# Bereket Dairy — Factory Management System

Web application for the Bereket Dairy factory: sales orders, daily production by batches, a warehouse with two sections
(Finished Products · Ingredients & Production Items), stock movements, purchases and sales with FIFO costing, customers, safes, receipts and reports.
Works in any browser on PC, tablet and phone, and can be installed to the home screen.

This is a **separate system** from Bereket Plastic FMS. It has its own GitHub repository (`Farhad800/bereket-dairy`),
its own Vercel project (`bereket-dairy`) and its own Neon database. It never connects to the plastic system's database or file store.

**Stack:** Next.js 15 (TypeScript, App Router, server actions) · Tailwind CSS · PostgreSQL (Neon) · Prisma 6 · server-side sessions · Vercel hosting.
**Languages:** English, Arabic (right-to-left), Turkish. Arabic and Turkish texts are machine-drafted and need review by a native speaker before go-live.
**Design:** black and white, with the Bereket Dairy logo used unaltered (`public/brand/bereket-dairy-logo.jpg`).

## What the system does

| Area | Summary |
|---|---|
| Products & Recipes | A product (cup, bowl, bottle…) has a **recipe per batch** (milk in kg, cultures in g or mg…), packaging **per piece**, and optionally **pieces per carton** with items per carton. The expected pieces from one batch drive the loss figure. |
| Production | One sheet per day (one shift). For each product enter **batches** and **pieces produced**. Loss = batches × pieces per batch − pieces produced. Saving takes the ingredients and packaging from stock, **all or nothing**: if any item is short, nothing is saved and the message names every missing item. |
| Warehouse | Two sections: **Finished Products** (pieces, shown as cartons + loose pieces) and **Ingredients & Production Items** (kg or pieces, down to 0.000001 kg = 1 mg). Movement list and the **daily in/out report**. |
| Stock movements | Input (opening, return, transfer, count…) and Output (return, transfer, count, damage, expired, sample…) by the warehouse; Buy and Sell by the accountant. Stock can **never go below zero**: a save that would do so is refused with the reason and the items that are short. |
| Money | FIFO batch costing, customers and balances, discounts, safes (IQD/USD/EUR), exchanges and transfers, receipts. Only money roles see prices and values — also not in the page data. |
| Reports | Production (with loss), production entries, consumption, orders, demand, warehouse daily in/out, trade, cash. CSV export; money columns only for money roles. |

The plastic-only modules (machines, molds, technical service, quality control, labels, Excel item workbook) are removed. See [docs/DAIRY-ADAPTATION.md](docs/DAIRY-ADAPTATION.md).

## Run locally

Requires Node.js 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env           # point DATABASE_URL / DATABASE_URL_UNPOOLED at a LOCAL database
npm run db:deploy              # apply migrations
ADMIN_USERNAME=admin npm run db:seed   # prints a one-time temporary admin password
npm run dev                    # http://localhost:3000
```

Optional demo accounts (one per role, password `Demo12345!`) and demo items: `npm run demo:add` — remove them before going live with `npm run demo:remove`.

## Security model (summary)

- Passwords hashed with bcrypt (cost 12); temporary passwords must be changed at first sign-in; 5 failed sign-ins lock the account for 15 minutes.
- Session token in an httpOnly cookie; only its SHA-256 hash is stored. Disabling an employee ends all their sessions immediately.
- Every server action checks a `resource:action` permission **on the server**. Hiding a button is never the only protection.
- Warehouse staff record ins and outs and see quantities only; prices, values, payments and money reports are withheld by the server.
- Stock writes lock the affected item rows, check stock inside the same transaction and are idempotent (a double press saves once).
- Secrets live only in server environment variables (Vercel), never in the repository or the browser.

Details: [docs/SECURITY.md](docs/SECURITY.md). Passing tests are evidence, not a guarantee: see the known limits listed there.

## Documentation

| Guide | For |
|---|---|
| [USER-GUIDE.md](docs/USER-GUIDE.md) | Employees — quick guide per role |
| [OPERATIONS.md](docs/OPERATIONS.md) | Administrator — employees, go-live reset, integrity check, monitoring |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + Neon + Blob setup, environment variables, migrations, first admin, updates |
| [BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md) | Automated backups and step-by-step restore |
| [SECURITY.md](docs/SECURITY.md) | Security controls, role-permission matrix, test results, known limits |
| [TESTING.md](docs/TESTING.md) | Test suites and how to run them |
| [DAIRY-ADAPTATION.md](docs/DAIRY-ADAPTATION.md) | What changed from the plastic system: removed modules, schema changes, stock rules |
