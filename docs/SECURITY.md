# Security

Passing tests show that the controls below behave as intended in the tested cases. They do **not** make the system "secure" or
"production-ready" on their own — see *Known limits* at the end, and have the deployment reviewed before real data goes in.

## Controls in place

**Sign-in and sessions**
- Individual accounts only; bcrypt (cost 12); minimum 10 characters with letters and numbers.
- Temporary passwords (new employee, reset) must be changed at first sign-in; until then every server action is refused.
- 5 failed attempts lock the account for 15 minutes; "unknown user" and "wrong password" give the same message.
- Session = random 256-bit token in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie; only its SHA-256 hash is stored; 12-hour lifetime.
- Disabling an employee deletes all their sessions at once. Changing a password signs out the other devices.
- The first administrator needs a one-time setup code; `/setup` disappears once an administrator exists.

**Authorisation (server-side)**
- Permissions are `resource:action` pairs per role, checked **on the server** in every server action, API route and protected page.
- **Money only with Safe → View (owner's rule, 28 Oct 2026):** prices, costs, stock values, totals, payments, balances, phone numbers,
  receipts and money reports are shown only to roles with `cash:view` — in the warehouse, dashboard, reports, exports and notifications alike.
  A role without it loses every money permission (`stock:buy`, `stock:sell`, the other `cash:*`, `customers:*`, `receipts:manage`) on the server,
  whatever its other ticks say; the role editor greys those out and says why. For everyone else they are removed from the **page data** itself, not just hidden;
  money columns are left out of CSV exports; scanned papers on Buy/Sell documents can't be opened.
- The Warehouse Team can record Input and Output documents only; a crafted request for a Buy, Sell, cost change, production entry or safe entry is refused.

**Stock integrity**
- Every save that moves stock runs in one database transaction that first locks the affected item rows (`SELECT … FOR UPDATE`, in a fixed order to avoid deadlocks),
  then checks the stock, then writes. Two people can't take the same kilo of milk at the same moment.
- Stock never goes below zero: production, Output and Sell are refused when an item is short. Edits to older documents (a purchase reduced, a production entry
  corrected down) are checked against the running balance from that moment on. The refusal names each item with needed / in stock / short, and nothing is saved.
- Each form submission carries a key; the same submission sent twice (double press, retry after a lost reply) is applied once.
- `scripts/check-integrity.ts` re-checks the whole ledger read-only.

**Requests and data**
- Next.js server actions reject cross-site requests (Origin must match) — CSRF protection.
- Prisma with bound parameters; raw SQL uses parameterised tagged templates; report filters are validated against allow-lists.
- React escapes all text; CSV exports neutralise spreadsheet formulas.
- Uploads: type checked from the file's bytes (JPG/PNG/WEBP/HEIC/PDF), 8 MB limit, private Blob store, served after a permission check with `nosniff` and a sandboxing CSP.
- Audit log of sensitive actions with before/after values and reasons; nobody can edit or delete it.

**Transport, headers, secrets**
- HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, restrictive `Permissions-Policy`, no `X-Powered-By`.
- Secrets (database URLs, Blob token, VAPID private key) exist only as server environment variables of the `bereket-dairy` Vercel project — never in browser code or the repository (`.env*` is git-ignored; only `.env.example`, without values, is committed).
- The service worker caches only static files and the offline page, never signed-in pages or factory data.
- Separation: the dairy code contains no connection details for the plastic system's database or Blob store; the test scripts refuse any non-localhost database.

## Role-permission matrix (defaults)

Every active employee can *view* orders, production, warehouse, stock movements, products, reports and the employee list. Money is visible only with a ✔ in `cash:view` (Safe → View); without it the money permissions in the table have no effect.

| Permission | Admin | Accountant | Sales | Production | Warehouse |
|---|:-:|:-:|:-:|:-:|:-:|
| `orders:view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `orders:create` | ✔ |  | ✔ |  |  |
| `orders:edit` | ✔ |  | ✔ |  |  |
| `orders:approve` | ✔ |  | ✔ |  |  |
| `orders:export` | ✔ | ✔ | ✔ |  |  |
| `orders:archive` | ✔ |  | ✔ |  |  |
| `production:view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `production:create` | ✔ |  |  | ✔ |  |
| `production:edit` | ✔ |  |  | ✔ |  |
| `production:export` | ✔ | ✔ |  |  |  |
| `warehouse:view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `warehouse:export` | ✔ | ✔ |  |  | ✔ |
| `stock:view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `stock:input` | ✔ | ✔ |  |  | ✔ |
| `stock:output` | ✔ | ✔ |  |  | ✔ |
| `stock:buy` | ✔ | ✔ |  |  |  |
| `stock:sell` | ✔ | ✔ |  |  |  |
| `receipts:manage` | ✔ | ✔ |  |  |  |
| `customers:view` | ✔ | ✔ |  |  |  |
| `customers:manage` | ✔ | ✔ |  |  |  |
| `cash:view` | ✔ | ✔ |  |  |  |
| `cash:in` | ✔ | ✔ |  |  |  |
| `cash:out` | ✔ | ✔ |  |  |  |
| `cash:exchange` | ✔ | ✔ |  |  |  |
| `cash:transfer` | ✔ | ✔ |  |  |  |
| `cash:manage` | ✔ | ✔ |  |  |  |
| `cash:export` | ✔ | ✔ |  |  |  |
| `products:view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `products:create` | ✔ | ✔ |  |  |  |
| `products:edit` | ✔ | ✔ |  |  |  |
| `products:archive` | ✔ |  |  |  |  |
| `products:export` | ✔ | ✔ |  |  |  |
| `reports:view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `reports:export` | ✔ | ✔ | ✔ |  | ✔ |
| `users:view` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `users:manage` | ✔ |  |  |  |  |
| `roles:view` | ✔ |  |  |  |  |
| `roles:manage` | ✔ |  |  |  |  |
| `settings:view` | ✔ |  |  |  |  |
| `settings:manage` | ✔ |  |  |  |  |
| `audit:view` | ✔ | ✔ |  |  |  |
| `audit:export` | ✔ |  |  |  |  |

`reports:export` for the Warehouse Team covers quantity reports only; money reports stay closed without a money permission.
The administrator can change the matrix in Administration → Roles & permissions; the Administrator role always keeps every permission.

## Test results (28 Oct 2026, local test databases, synthetic data only)

- `tests/e2e/security.py` — **28/28**: signed-out access refused; forged session cookie refused; security headers; setup page closed; no user enumeration; lockout; only hashes stored; cookie flags;
  a Production user replaying an administrator's server action is refused; foreign Origin rejected (CSRF) while the genuine request works; disabled employee signed out; SQL-like input harmless; HTML shown as text; HTML renamed `.pdf` rejected; unknown file ids 404; another employee's notification can't be opened; security events audited.
- `tests/e2e/m3-m4.py` — **29/29**: warehouse sees no prices, totals, payments or phones — also not in the page data — and gets no money report or CSV; an administrator on a temporary password is refused everywhere.
- `tests/e2e/dairy.py` — **90/90**, including: shortages refused with the item named and nothing saved; simultaneous saves (only one of two can take the last 25 kg of sugar); the same submission ×3 applied once; warehouse refused Buy, production and cost changes; warehouse CSV without price columns.
- `npm audit --omit=dev`: **0 known vulnerabilities**, after pinning `zod` 4.6.7 through `overrides` (it came in through `@vercel/blob`).

## Known limits / recommendations

- **Both GitHub repositories are public today.** Make `Farhad800/bereket-dairy` private before real data or settings go in.
  The plastic repository's `PROGRESS.md` contains an administrator password: change that password and remove it from the repository history.
  This was **not** done here, because the plastic system is out of scope.
- Mark `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN` and `VAPID_PRIVATE_KEY` as **Sensitive** in the `bereket-dairy` Vercel project.
- Preview deployments share the production variables unless scoped (DEPLOYMENT.md §2).
- Lockout is per account, not per IP; add a Vercel Firewall rate-limit rule on `/login`.
- No two-factor sign-in.
- Tests ran on local PostgreSQL 16, not on Neon; repeat the smoke checks after the first deployment.
- Review dependencies monthly (`npm audit`).
