# Operations guide (for the system administrator)

Day-to-day running of the Bereket Dairy FMS. No programming needed for sections 1–3 and 5–7.

## 1. Daily and weekly checks

| When | Check | Where |
|---|---|---|
| Daily | The site opens and you can sign in | the `bereket-dairy` Vercel domain |
| Daily | Today's production was entered and the loss looks normal | Production · Reports → Production |
| Daily | Warehouse ins and outs match the paper slips | Reports → Warehouse daily in/out |
| Weekly | Last night's backup is green | GitHub → `Farhad800/bereket-dairy` → Actions → *Nightly backup (Bereket Dairy)* |
| Weekly | Read-only integrity check is clean (§4) | command line |
| Weekly | No unexpected errors | Vercel → `bereket-dairy` → Logs, filter `"level":"error"` |
| Monthly | Departed employees are disabled | Administration → Employees |
| Every 3 months | Restore drill | BACKUP-RESTORE.md |

**Uptime alert (recommended):** monitor `https://<domain>/api/health` every 5 minutes with a free uptime service. It answers `{"status":"ok"}` only when the app **and** the dairy database are working.

## 2. Employees and roles

- **Add:** Administration → Employees → *New employee*. Pick the role. A **temporary password** is shown **once** — hand it over privately. The employee must choose their own at first sign-in, and can do nothing else until then.
- **Forgotten password:** *Reset password* → new temporary password, shown once. Open sessions are sent back to *Change password*.
- **Locked out:** 5 wrong passwords lock the account for 15 minutes.
- **Roles:** Administration → Roles & permissions. Built-in roles: Administrator, Accountant, Sales Manager, Production Team, Warehouse Team. The full matrix is in SECURITY.md. Be careful giving `stock:buy`, `stock:sell` or `cash:view` to anyone: any one of them shows **all prices, values and money**.

### When someone leaves

1. Administration → Employees → **Disable**. They are signed out everywhere immediately.
2. Don't delete them — their name stays on their records (audit trail).
3. If they knew the admin password or the backup passphrase, change those. Remove them from Vercel, Neon and GitHub if they had access.

## 3. Starting real use (go-live)

1. Make sure a backup exists (Actions → Nightly backup → *Run workflow*, wait for green).
2. Administration → **System**:
   - **Demo employee accounts** → *Remove demo accounts* (usernames starting with `demo.`).
   - **Clear test data before going live** → *Test transactions only* (orders, production, stock documents, safe entries; keeps products, recipes and items) or *Everything* (also products, items and customers). Type `RESET` and your password.
3. Never deleted: employees, roles, departments, settings, the audit log.
4. Enter **opening stock**: Stock Movements → New → **Input**, reason *Opening stock*, for every ingredient and product on the shelf. Production and sales are refused until the stock is there.

Command line (same logic): `npx tsx scripts/go-live.ts preview | reset-operations --yes | reset-everything --yes | remove-demo-users --yes`.
It prints the database host first — check it is the **dairy** database.

## 4. Read-only integrity check

```bash
DATABASE_URL=<dairy direct connection string> npx tsx scripts/check-integrity.ts
```

Runs inside a `READ ONLY` transaction and changes nothing. It reports:

1. products whose production stock differs from their production entries;
2. any moment in the ledger when an item was below zero;
3. production entries that gave back more of an item than they used.

Expected result: `no inconsistencies found.` Anything else: don't fix data by hand; take a backup and investigate the named records.

## 5. Audit log

Insights → **Audit log** (`audit:view`). Who did what and when, with old → new values and reasons: sign-ins, employee and role changes, orders, production entries and corrections, stock documents and their edits, safe entries, report exports, go-live resets. A save refused for missing stock leaves no entry, because nothing was saved. Nobody can edit or delete the log.

## 6. Scanned papers (attachments)

- Only stock documents carry files (delivery notes, slips, invoices). JPG, PNG, WEBP, HEIC or PDF, up to 8 MB; the server checks the file's real content.
- Files on **Buy** and **Sell** documents are visible only to money roles.
- Files live in the dairy project's **private** Blob store; every view goes through the app's permission check. Included in the nightly backup.

## 7. Language and time

- English, Arabic (right-to-left) or Turkish per employee (globe icon). Arabic and Turkish wording needs a native speaker's review (`messages/ar.json`, `messages/tr.json`).
- Times are in `FACTORY_TIMEZONE` (Asia/Baghdad). There is **one shift**: a production day is the calendar day.

## 8. Errors and monitoring

- A failed page shows a short **ref** code; the server log has the same code (`digest`) — search for it in Vercel → Logs.
- `/api/health` checks the database.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Not enough stock. Nothing was saved." | An ingredient, packaging item or product is short | The message lists each item: needs, in stock, short. Record the missing Input/Buy first, then save again. |
| Production says "No batch recipe yet" | The product has no ingredients per batch | Products & Recipes → product → add ingredients and pieces per batch |
| Loss looks wrong | Pieces expected per batch not set or outdated | Product page → *Pieces expected from one batch* |
| Warehouse user sees no prices | By design | Prices need `stock:buy`, `stock:sell` or `cash:view` |
| Everyone sees "This page couldn't load" | Database unreachable or out of quota | `/api/health`; Neon console |
| Uploads fail | Blob store missing or token wrong | Vercel → Storage; `BLOB_READ_WRITE_TOKEN` |
| One employee can't sign in | Locked or disabled | Wait 15 min or reset; check *Active* |
| Times look 3 hours off | `FACTORY_TIMEZONE` missing | Set `Asia/Baghdad`, redeploy |
