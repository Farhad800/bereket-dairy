# Deployment guide

Bereket Dairy Factory Management System — how it is hosted, configured, set up and updated.

> **Status: live since 28 Oct 2026** at https://bereket-dairy.vercel.app (Vercel project `bereket-dairy`, functions in iad1 / Washington — the same region as the Neon database),
> on the dairy Neon database and the private Blob store `bereket-dairy-files`. Deployed from `main` on the owner's go-ahead.
> The project is not linked to Git: pushes do not deploy by themselves; a new production deployment is started by hand.

## Region: keep the app next to its database

The Neon database of this project is in **iad1 (Washington, US East)**; a Neon project's region can't be changed later.
The app's functions must run in the **same region** (Vercel → Settings → Functions → Region = iad1). Each page makes 8–18 database
round trips; with the app in Frankfurt and the database in Washington each trip costs ~90 ms, so pages took 0.6–1.7 s on the server
instead of 0.02–0.2 s (measured 28 Oct 2026 on a copy with the 521-item opening list). Moving both to Frankfurt (fra1) would be faster
still for Iraq, but needs a new Neon database in fra1 and a copy of the data (see BACKUP-RESTORE.md, procedure B).

## 0. Keep it separate from Bereket Plastic

| | Bereket Dairy (this system) | Bereket Plastic (do not touch) |
|---|---|---|
| GitHub | `Farhad800/bereket-dairy` | `Farhad800/berecket` |
| Vercel project | `bereket-dairy` | `bereket-fms` |
| Neon database | the store connected to `bereket-dairy` only | the store connected to `bereket-fms` |
| Blob store | a **new** private store, connected to `bereket-dairy` only | the plastic store |

Before any deployment, check in Vercel → `bereket-dairy` → Settings → Environment Variables that `DATABASE_URL` points at the
dairy database (its host name should match the dairy Neon store, not the plastic one). Never copy environment variables from the plastic project.

## 1. Where it runs and what it costs

| Part | Service | Notes |
|---|---|---|
| Web app + server code | **Vercel** | Built for Next.js; automatic HTTPS; instant rollback. **Hobby (free) is for non-commercial use only** — a factory system is commercial use, so plan for Vercel **Pro** before go-live. |
| Database | **Neon** PostgreSQL, connected through the Vercel Marketplace | Free plan restore window is short (hours). Recommended: a paid plan with a **7-day** restore window. |
| Scanned papers (photos / PDFs on stock documents) | **Vercel Blob**, *private* store | Files have no public link; served only through the app after a permission check. |
| Code | GitHub `Farhad800/bereket-dairy` | Make the repository **private** before real data goes in (it is public today). Nightly backups run here. |

## 2. Environments

| | Local development | Testing | Production |
|---|---|---|---|
| URL | http://localhost:3000 | http://localhost:3001 | the `bereket-dairy` Vercel domain (e.g. `bereket-dairy.vercel.app`) |
| Database | local PostgreSQL `dairy` | throw-away local database `dairy_accept` (recreated for every suite) | the dairy Neon database |
| Files | `./.uploads` | `./.uploads` | private Blob store of `bereket-dairy` |
| Demo accounts | allowed (`npm run demo:add`) | created by the tests | **never** — the scripts refuse unless `ALLOW_DEMO=1` |

**Preview deployments share the production environment variables** unless you scope them. The build step `scripts/db-deploy.mjs`
skips migrations and seed on preview builds, but a running preview still reads and writes the dairy database. Either scope the database
variables to *Production* only, or create a Neon branch for previews. Keep Deployment Protection (Vercel login) on for previews.

## 3. Environment variables

Set in Vercel → `bereket-dairy` → Settings → Environment Variables. Mark every secret as **Sensitive**.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (used by the app). Added by the Neon integration. |
| `DATABASE_URL_UNPOOLED` | yes | Neon **direct** connection string (migrations, backups). Added by the Neon integration. |
| `BLOB_READ_WRITE_TOKEN` | yes (production) | Token of the dairy project's private Blob store. Without it, files go to local disk (development only). |
| `FACTORY_TIMEZONE` | yes | `Asia/Baghdad`. Drives "today" and every displayed time. |
| `SETUP_TOKEN` | first setup only | One-time code for creating the first administrator at `/setup`. Remove it once the admin exists. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | optional | Web Push notifications. Generate a **new** pair for dairy (`npx web-push generate-vapid-keys`); never reuse the plastic keys. |
| `FIFO_START` | optional | Oldest date FIFO costing looks at (default 2000-01-01). |
| `ALLOW_DEMO` | no | Leave unset in production. |

`.env.example` lists the same variables (without values) for local development.

## 4. First deployment (after "Yes, deploy now")

1. Request push access and push `main` to `Farhad800/bereket-dairy`; connect the repository to the existing Vercel project `bereket-dairy` (framework Next.js).
2. Confirm the Neon store connected to `bereket-dairy` is the dairy one → `DATABASE_URL` and `DATABASE_URL_UNPOOLED` exist.
3. Vercel → Storage → **Create Blob store**, access **Private**, connect it to `bereket-dairy` only → `BLOB_READ_WRITE_TOKEN` appears.
4. Add `FACTORY_TIMEZONE=Asia/Baghdad` and a long random `SETUP_TOKEN`.
5. Build command (from `package.json`) is `npm run vercel-build`:
   `make-icons` → `prisma generate` → `scripts/db-deploy.mjs` (**production only:** `prisma migrate deploy`, then the idempotent seed: roles, departments, settings) → `next build`.
6. Deploy. Check `https://<domain>/api/health` → `{"status":"ok"}`.
7. Open `/setup`, create the administrator, then remove `SETUP_TOKEN`.

### Migrations

The dairy database starts from two migrations:

| Migration | What it does |
|---|---|
| `20261028120000_dairy_init` | Creates the whole dairy schema in one step (no plastic history). |
| `20261028120100_dairy_base_data` | Adds the main safe (IQD/USD/EUR) and the standard expense categories. |

Every deployment applies pending migrations before the new code goes live; if a migration fails, the build fails and the old version keeps running.
Never edit an applied migration — add a new one. These migrations are for an **empty** dairy database; they are not meant to run on the plastic database.

## 5. Initial administrator

1. With `SETUP_TOKEN` set and no administrator in the database, open `https://<domain>/setup`.
2. Enter the setup code, employee ID, name, username and a strong password (10+ characters with letters and numbers).
3. `/setup` returns 404 for good once an administrator exists. Remove `SETUP_TOKEN` in Vercel.

Command-line alternative: `ADMIN_USERNAME=admin npm run db:seed` prints a one-time temporary password that must be changed at first sign-in.

## 6. Updating the application

1. Commit to `main`; Vercel builds it, applies migrations, and switches traffic only when the build succeeds.
2. Verify `/api/health`, sign in, open a few pages, and run the read-only integrity check (OPERATIONS.md §4).
3. **If something is wrong:** Vercel → Deployments → previous deployment → **Instant Rollback**. If a migration changed data, also restore the database (BACKUP-RESTORE.md).

## 7. Running on your own server instead (optional)

Requirements: Node.js 20+, PostgreSQL 14+, a reverse proxy with HTTPS.

```bash
npm ci
export DATABASE_URL=… DATABASE_URL_UNPOOLED=… FACTORY_TIMEZONE=Asia/Baghdad
npm run db:deploy && SEED_SKIP_ADMIN=1 npm run db:seed && npm run build
SETUP_TOKEN=<random> npm start     # then open /setup once
```

Without `BLOB_READ_WRITE_TOKEN`, files are stored in `./.uploads` — include that folder in your backups.
