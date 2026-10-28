import "server-only";
import type { Tx } from "./db";
import { needsFor, r6, type Recipe } from "./recipe-math";
import { stampNow } from "./stock";
export type { Need } from "./recipe-math";

/**
 * What a production entry uses from stock — its recipe's ingredients (× batches) and packaging
 * (× pieces / × cartons) — taken off when production is entered, given back when it is corrected down.
 * Each entry keeps a running balance per item: corrections only post the difference.
 * The caller locks the items and checks stock BEFORE writing (see lib/stock.ts): production is never
 * saved when anything is short.
 */
export const RECIPE_SELECT = {
  id: true, code: true, name: true, unit: true, kind: true, piecesPerCarton: true, batchYield: true, archivedAt: true,
  components: { select: { qty: true, per: true, component: { select: { id: true, code: true, name: true, unit: true } } } },
} as const;

/** How much MORE of each item this entry needs (+) or gives back (−), for `batches` and `pieces`. */
export async function consumptionDiff(tx: Tx, product: Recipe, entryId: string | null, batches: number, pieces: number): Promise<Map<string, number>> {
  const need = new Map(needsFor(product, batches, pieces).map((n) => [n.componentId, n.qty]));
  const used = entryId ? await tx.stockMovement.groupBy({ by: ["productId"], where: { entryId, type: "USE" }, _sum: { qty: true } }) : [];
  const ids = new Set([...need.keys(), ...used.map((u) => u.productId)]);
  const out = new Map<string, number>();
  for (const id of ids) {
    const already = -Number(used.find((u) => u.productId === id)?._sum.qty ?? 0); // positive amount used so far
    const diff = r6((need.get(id) ?? 0) - already);
    if (Math.abs(diff) > 1e-7) out.set(id, diff);
  }
  return out;
}

/** Writes the differences worked out by consumptionDiff (call after locking and checking stock). */
export async function writeConsumption(tx: Tx, entryId: string, diffs: Map<string, number>, userId: string, label: string) {
  const at = stampNow();
  for (const [id, diff] of diffs) {
    await tx.stockMovement.create({ data: { productId: id, type: "USE", qty: -diff, entryId, reason: `Production ${label}`, createdById: userId, createdAt: at } });
  }
}
