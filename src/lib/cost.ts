/**
 * Product cost, always in IQD, worked out the way the accountant does it:
 * for a run of B batches giving N pieces, take the SAME quantities production takes out of stock
 * (recipe-math.ts: ingredients × batches, packaging × pieces, cartons rounded up to whole ones),
 * cost each from its batches in stock (oldest first, FIFO), add up, and divide by the pieces made.
 * Losses are therefore inside the cost: fewer pieces from the same batches = a higher cost per piece.
 */
import { needsFor, type Recipe } from "./recipe-math";

/**
 * costIqd: cost of one unit when no batch is left (the latest batch, else the starting cost).
 * lots: batches still in stock, oldest first — the amounts used are costed from these first (oldest first).
 */
export type CostItem = { id: string; code: string; name: string; unit: string; costIqd: unknown; lots?: { left: number; unit: number | null }[] };

/** Cost of taking `qty` from the batches, oldest first; beyond them at `fallback`. null = some of it has no cost. */
export function fifoTake(lots: { left: number; unit: number | null }[] | undefined, fallback: number | null, qty: number): number | null {
  let need = qty, cost = 0;
  for (const l of lots ?? []) {
    if (need <= 1e-9) break;
    const q = Math.min(l.left, need);
    if (q <= 0) continue;
    if (l.unit === null) return null;
    cost += q * l.unit; need -= q;
  }
  if (need > 1e-9) { if (fallback === null) return null; cost += need * fallback; }
  return cost;
}
export type CostRecipe = {
  piecesPerCarton: number | null;
  components: { qty: unknown; per: "BATCH" | "PIECE" | "CARTON"; component: CostItem }[];
};
export type CostPart = { id: string; code: string; name: string; unit: string; qty: number; unitCost: number | null; cost: number | null; why: "batch" | "piece" | "carton" };
export type ProductCost = { batches: number; pieces: number; parts: CostPart[]; total: number; perPiece: number; missing: CostPart[]; noRecipe: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cost of a run of `batches` batches giving `pieces` pieces, and of one piece of that run. */
export function productCost(p: CostRecipe, batches: number, pieces: number): ProductCost {
  const items = new Map<string, CostItem>();
  const why = new Map<string, CostPart["why"]>();
  for (const l of p.components) {
    items.set(l.component.id, l.component);
    if (!why.has(l.component.id)) why.set(l.component.id, l.per === "BATCH" ? "batch" : l.per === "PIECE" ? "piece" : "carton");
  }
  const n = Math.max(0, Math.floor(pieces));
  const b = Math.max(0, batches);
  const parts: CostPart[] = needsFor(p as unknown as Recipe, b, n).map((need) => {
    const it = items.get(need.componentId)!;
    const u = it.costIqd === null || it.costIqd === undefined ? null : Number(it.costIqd);
    const cost = fifoTake(it.lots, u, need.qty);
    // shown per unit: the average of the batches used (the same as the cost per unit when one batch covers it)
    const unitCost = cost !== null && need.qty > 0 ? cost / need.qty : u;
    return { id: it.id, code: it.code, name: it.name, unit: it.unit, qty: need.qty, unitCost, cost, why: why.get(it.id)! };
  });
  const missing = parts.filter((x) => x.cost === null);
  const total = r2(parts.reduce((s, x) => s + (x.cost ?? 0), 0));
  return { batches: b, pieces: n, parts, total, perPiece: n > 0 ? total / n : 0, missing, noRecipe: p.components.length === 0 };
}

/** The run a cost is shown for when none is typed: the last production entry, else 1 batch at its expected pieces. */
export function defaultRun(batchYield: number | null | undefined, last: { batches: number; pieces: number } | null | undefined) {
  if (last && last.pieces > 0 && last.batches > 0) return last;
  return { batches: 1, pieces: batchYield && batchYield > 0 ? batchYield : 1000 };
}

/** IQD with up to 2 decimals (153,100.5 · 29.53), more only for amounts below 1 IQD. */
export const fmtIqd = (n: number) => n.toLocaleString("en", { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 4 });
