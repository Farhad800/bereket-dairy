import "server-only";
import { db, type Tx } from "./db";
import { defaultRun, productCost, type CostRecipe, type ProductCost } from "./cost";

const item = { id: true, code: true, name: true, unit: true, costIqd: true, kind: true } as const;
export const COST_SELECT = {
  piecesPerCarton: true, batchYield: true,
  components: { select: { qty: true, per: true, component: { select: item } }, orderBy: { createdAt: "asc" as const } },
};

/** The last production run of each product (batches + pieces): the run its cost is shown for by default. */
export async function lastMade(ids?: string[], tx: Tx = db) {
  const rows = await tx.productionEntry.findMany({
    where: { quantity: { gt: 0 }, ...(ids ? { productId: { in: ids } } : {}) },
    orderBy: [{ productId: "asc" }, { day: "desc" }, { createdAt: "desc" }],
    distinct: ["productId"], select: { productId: true, quantity: true, batches: true },
  });
  return new Map(rows.map((r) => [r.productId, { batches: Number(r.batches), pieces: r.quantity }]));
}

type Entry = { recipe: CostRecipe; batches: number; pieces: number; fromProduction: boolean; cost: ProductCost };

/**
 * Recipe with costs for each product, the default run, and the cost of that run.
 * Normally each item is costed from its batches in stock (FIFO, oldest first) then at its latest cost;
 * with `starting`, at each item's starting cost (used for opening stock).
 */
export async function productCosts(ids?: string[], tx: Tx = db, opts: { starting?: boolean } = {}) {
  const [list, made, fifo] = await Promise.all([
    tx.product.findMany({ where: { kind: "PRODUCT", ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, ...COST_SELECT } }),
    lastMade(ids, tx),
    opts.starting ? null : import("./fifo").then((m) => m.fifoState()),
  ]);
  const withLots = <T extends { id: string; costIqd: unknown }>(c: T) => (!fifo ? c
    : fifo.partial(c.id) ? { ...c, costIqd: null, lots: [] }
    : { ...c, costIqd: fifo.lastUnit(c.id), lots: fifo.remaining(c.id).map((l) => ({ left: l.left, unit: l.unit() })) });
  const out = new Map<string, Entry>();
  for (const p of list) {
    const recipe: CostRecipe = { piecesPerCarton: p.piecesPerCarton, components: p.components.map((l) => ({ ...l, component: withLots(l.component) })) };
    const run = defaultRun(p.batchYield, made.get(p.id));
    out.set(p.id, { recipe, batches: run.batches, pieces: run.pieces, fromProduction: made.has(p.id), cost: productCost(recipe, run.batches, run.pieces) });
  }
  return out;
}
