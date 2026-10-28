/**
 * Pure maths shared by the server (stock use, stock check) and the product page (preview).
 *
 * Dairy rules (owner, 28 Oct 2026):
 *  - BATCH lines (milk, sugar, cultures…): recipe amount × batches made
 *  - PIECE lines (cups, lids, labels…): amount × pieces actually produced
 *  - CARTON lines (cartons, tape…): amount × cartons packed, where cartons = ⌈pieces ÷ pieces per carton⌉
 *    (a started carton is used)
 *  - kg items are kept to 6 decimals (1 mg); piece items are always whole (rounded up)
 */
export type Need = { componentId: string; code: string; name: string; unit: string; qty: number };

export type RecipeLine = { qty: unknown; per: "BATCH" | "PIECE" | "CARTON"; component: { id: string; code: string; name: string; unit: string } };
export type Recipe = { piecesPerCarton?: number | null; components: RecipeLine[] };

export const isKg = (u: string) => u.toLowerCase() === "kg";
/** Rounds to 6 decimals (1 mg for kg). */
export const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Cartons needed for `pieces` (0 when the product isn't packed in cartons). */
export function cartonsFor(pieces: number, piecesPerCarton: number | null | undefined) {
  if (!piecesPerCarton || piecesPerCarton <= 0 || pieces <= 0) return 0;
  return Math.ceil(pieces / piecesPerCarton - 1e-9);
}

/** What `batches` batches giving `pieces` pieces of a product use from stock. */
export function needsFor(p: Recipe, batches: number, pieces: number): Need[] {
  const out = new Map<string, Need>();
  const cartons = cartonsFor(pieces, p.piecesPerCarton);
  for (const line of p.components) {
    const q = Number(line.qty), c = line.component;
    if (!(q > 0)) continue;
    const times = line.per === "BATCH" ? batches : line.per === "PIECE" ? pieces : cartons;
    if (!(times > 0)) continue;
    const cur = out.get(c.id) ?? { componentId: c.id, code: c.code, name: c.name, unit: c.unit, qty: 0 };
    cur.qty = r6(cur.qty + q * times);
    out.set(c.id, cur);
  }
  // Piece items are whole: a started piece is used.
  for (const n of out.values()) if (!isKg(n.unit)) n.qty = Math.ceil(n.qty - 1e-9);
  return [...out.values()].filter((n) => n.qty > 0);
}

/** Pieces lost against what the batches should have given (null when the product has no batch yield). */
export function lossOf(batches: number, pieces: number, perBatch: number | null | undefined) {
  if (!perBatch || perBatch <= 0 || !(batches > 0)) return null;
  const expected = Math.round(batches * perBatch);
  const lost = expected - pieces;
  return { expected, lost, pct: expected > 0 ? Math.round((lost / expected) * 10000) / 100 : 0 };
}

/** Splits pieces into full cartons + loose pieces for display ("12 cartons + 40 pcs"). */
export function cartonSplit(pieces: number, piecesPerCarton: number | null | undefined) {
  if (!piecesPerCarton || piecesPerCarton <= 0) return null;
  const whole = Math.floor(Math.max(0, pieces) / piecesPerCarton);
  return { cartons: whole, loose: Math.max(0, pieces) - whole * piecesPerCarton };
}

/** "520 kg" · "0.4 g" (kg amounts below 1 kg read better in grams) · "1,200 pcs". */
export function fmtAmount(q: number, unit: string, pcsLabel = "pcs") {
  const f = (n: number, d = 6) => n.toLocaleString("en", { maximumFractionDigits: d });
  if (isKg(unit)) return Math.abs(q) > 0 && Math.abs(q) < 1 ? `${f(r6(q * 1000), 3)} g` : `${f(r6(q))} kg`;
  return `${f(q, 0)} ${pcsLabel}`;
}
