import { describe, expect, it } from "vitest";
import { defaultRun, fifoTake, productCost } from "@/lib/cost";

const it_ = (id: string, unit: string, costIqd: number | null, lots?: { left: number; unit: number | null }[]) => ({ id, code: id, name: id, unit, costIqd, lots });

describe("product cost the accountant's way (same quantities production takes from stock)", () => {
  // Synthetic recipe: 1 batch = 500 kg milk + 20 kg sugar + 0.4 g culture; 1 cup + 1 lid per piece; 1 carton per 12.
  const yog = {
    piecesPerCarton: 12,
    components: [
      { qty: 500, per: "BATCH" as const, component: it_("MILK", "kg", 650) },
      { qty: 20, per: "BATCH" as const, component: it_("SUGAR", "kg", 1200) },
      { qty: 0.0004, per: "BATCH" as const, component: it_("CULT", "kg", 900000) },
      { qty: 1, per: "PIECE" as const, component: it_("CUP", "pcs", 45) },
      { qty: 1, per: "PIECE" as const, component: it_("LID", "pcs", 15) },
      { qty: 1, per: "CARTON" as const, component: it_("CARTON", "pcs", 300) },
    ],
  };
  it("costs 2 batches giving 1,900 cups: ingredients × batches, packaging × cups, whole cartons", () => {
    const c = productCost(yog, 2, 1900);
    expect(c.parts.map((p) => [p.id, p.qty, p.cost])).toEqual([
      ["MILK", 1000, 650000], ["SUGAR", 40, 48000], ["CULT", 0.0008, 720], ["CUP", 1900, 85500], ["LID", 1900, 28500], ["CARTON", 159, 47700],
    ]);
    expect(c.total).toBe(860420);
    expect(c.perPiece).toBeCloseTo(860420 / 1900, 6);
  });
  it("losses raise the cost per cup: same 2 batches, only 1,800 cups", () => {
    expect(productCost(yog, 2, 1800).perPiece).toBeGreaterThan(productCost(yog, 2, 1900).perPiece);
  });
  it("items without a cost are listed and left out", () => {
    const c = productCost({ ...yog, components: [...yog.components, { qty: 1, per: "PIECE" as const, component: it_("LABEL", "pcs", null) }] }, 1, 950);
    expect(c.missing.map((m) => m.id)).toEqual(["LABEL"]);
  });
  it("FIFO: takes the oldest batch first, then the next", () => {
    expect(fifoTake([{ left: 300, unit: 600 }, { left: 1000, unit: 700 }], 700, 500)).toBe(300 * 600 + 200 * 700);
    expect(fifoTake([{ left: 10, unit: null }], 5, 5)).toBeNull();
  });
  it("default run: last production, else 1 batch at its expected pieces", () => {
    expect(defaultRun(950, { batches: 1.5, pieces: 1400 })).toEqual({ batches: 1.5, pieces: 1400 });
    expect(defaultRun(950, null)).toEqual({ batches: 1, pieces: 950 });
    expect(defaultRun(null, null)).toEqual({ batches: 1, pieces: 1000 });
  });
});
