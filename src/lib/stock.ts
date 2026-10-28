import "server-only";
import { Prisma } from "@prisma/client";
import { db, type Tx } from "./db";
import { UserError } from "./action";
import { fmtAmount, r6 } from "./recipe-math";

/**
 * Stock on hand and the dairy rule: stock NEVER goes below zero (owner, 28 Oct 2026).
 *
 * Every save that moves stock does, inside ONE transaction:
 *   1. lockItems()     — holds every item it will touch (in a fixed order, so two saves never wait in a circle);
 *   2. requireStock()  — re-reads the real stock while holding them and refuses, naming every short item;
 *   3. writes its movements (stamped after the lock, so the ledger order matches the order things happened);
 *   4. neverNegative() — re-checks the ledger after writing (also covers edits of older documents).
 * Any refusal rolls the whole transaction back: nothing is saved, nothing is half-done.
 */

/** Stock on hand per item = SUM of its ledger movements (never a typed total). */
export async function getStock(productIds?: string[], tx: Tx = db): Promise<Map<string, number>> {
  const rows = await tx.stockMovement.groupBy({
    by: ["productId"],
    where: productIds ? { productId: { in: productIds } } : {},
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.productId, r6(Number(r._sum.qty ?? 0))]));
}

/** Locks the item rows so nobody else can move their stock until this transaction ends. Sorted → no deadlocks. */
export async function lockItems(tx: Tx, ids: Iterable<string>) {
  const list = [...new Set(ids)].sort();
  if (!list.length) return;
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(list)}) ORDER BY id FOR UPDATE`;
}
/** Kept for older call sites: locks one item. */
export const lockProduct = (productId: string, tx: Tx) => lockItems(tx, [productId]);

/** A time for movements written after the lock (database default would be the transaction's start time). */
export const stampNow = () => new Date();

export type Shortage = { id: string; code: string; name: string; unit: string; available: number; required: number };

/** "520 kg" · "0.4 g" · "1,200 pcs" */
export const fmtQty = (q: number, unit: string) => fmtAmount(q, unit, unit);

/** The refusal shown to the user: what was blocked, and every item that is short. */
export class ShortageError extends UserError {
  constructor(public shortages: Shortage[], what = "This can't be saved") {
    super(
      `${what}: not enough stock. Nothing was saved.\n` +
      shortages.map((s) => `• ${s.code} ${s.name} — needs ${fmtQty(s.required, s.unit)}, in stock ${fmtQty(Math.max(0, s.available), s.unit)}${s.available > 0 ? `, short ${fmtQty(r6(s.required - s.available), s.unit)}` : " (out of stock)"}`).join("\n"),
    );
  }
}

/**
 * Refuses unless every item has at least the amount going out. `out` = positive amounts leaving, per item.
 * `back` = amounts this same save gives back first (e.g. the old lines of a document being edited).
 * Call AFTER lockItems() for the same items.
 */
export async function requireStock(tx: Tx, out: Map<string, number>, what?: string, back: Map<string, number> = new Map()) {
  const ids = [...out.keys()].filter((id) => (out.get(id) ?? 0) > 0);
  if (!ids.length) return;
  const [stock, items] = await Promise.all([
    getStock(ids, tx),
    tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true, unit: true } }),
  ]);
  const short: Shortage[] = [];
  for (const it of items.sort((a, b) => a.code.localeCompare(b.code))) {
    const available = r6((stock.get(it.id) ?? 0) + (back.get(it.id) ?? 0));
    const required = r6(out.get(it.id) ?? 0);
    if (required - available > 1e-7) short.push({ id: it.id, code: it.code, name: it.name, unit: it.unit, available, required });
  }
  if (short.length) throw new ShortageError(short, what);
}

/**
 * After writing: no item's stock may be below zero at any point from `from` onwards
 * (from now when nothing older was changed). Refuses — and so rolls back — naming the items.
 */
export async function neverNegative(tx: Tx, ids: Iterable<string>, from?: Date, what?: string) {
  const list = [...new Set(ids)];
  if (!list.length) return;
  const finals = await tx.$queryRaw<{ id: string; low: Prisma.Decimal }[]>`
    SELECT "productId" AS id, SUM(qty) AS low FROM "StockMovement" WHERE "productId" IN (${Prisma.join(list)}) GROUP BY "productId"`;
  const running = from
    ? await tx.$queryRaw<{ id: string; low: Prisma.Decimal }[]>`
        SELECT "productId" AS id, MIN(run) AS low FROM (
          SELECT "productId", "createdAt", SUM(qty) OVER (PARTITION BY "productId" ORDER BY "createdAt", id) AS run
          FROM "StockMovement" WHERE "productId" IN (${Prisma.join(list)})
        ) t WHERE "createdAt" >= ${from} GROUP BY "productId"`
    : [];
  const lowest = new Map<string, number>();
  for (const r of [...finals, ...running]) lowest.set(r.id, Math.min(lowest.get(r.id) ?? Infinity, Number(r.low)));
  const rows = [...lowest].map(([id, low]) => ({ id, low }));
  const bad = rows.filter((r) => Number(r.low) < -1e-7);
  if (!bad.length) return;
  const items = await tx.product.findMany({ where: { id: { in: bad.map((b) => b.id) } }, select: { id: true, code: true, name: true, unit: true } });
  throw new UserError(
    `${what ?? "This can't be saved"}: stock would go below zero. Nothing was saved.\n` +
    items.sort((a, b) => a.code.localeCompare(b.code)).map((it) => {
      const low = Number(bad.find((b) => b.id === it.id)!.low);
      return `• ${it.code} ${it.name} — short ${fmtQty(r6(-low), it.unit)} (that much has already been used or sent out)`;
    }).join("\n"),
  );
}
