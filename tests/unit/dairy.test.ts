import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_ROLES } from "@/lib/permissions";
import { cartonSplit, cartonsFor, fmtAmount, lossOf, needsFor } from "@/lib/recipe-math";
import { dayValue, ymdOf } from "@/lib/production";

const role = (name: string) => DEFAULT_ROLES.find((r) => r.name === name)!.permissions;
const c = (id: string, unit: string) => ({ id, code: id, name: id, unit });

describe("batch recipes (owner, 28 Oct 2026)", () => {
  const recipe = {
    piecesPerCarton: 12,
    components: [
      { qty: 500, per: "BATCH" as const, component: c("MILK", "kg") },
      { qty: 0.0004, per: "BATCH" as const, component: c("CULT", "kg") }, // 0.4 g
      { qty: 2, per: "BATCH" as const, component: c("SACHET", "pcs") },
      { qty: 1, per: "PIECE" as const, component: c("CUP", "pcs") },
      { qty: 0.0005, per: "PIECE" as const, component: c("FOIL", "kg") }, // 0.5 g per cup
      { qty: 1, per: "CARTON" as const, component: c("CARTON", "pcs") },
    ],
  };
  const need = (b: number, p: number) => Object.fromEntries(needsFor(recipe, b, p).map((n) => [n.componentId, n.qty]));
  it("ingredients follow batches, packaging follows pieces, cartons are rounded up", () => {
    expect(need(1.5, 1400)).toEqual({ MILK: 750, CULT: 0.0006, SACHET: 3, CUP: 1400, FOIL: 0.7, CARTON: 117 });
  });
  it("piece items are whole: 2 sachets × 1.25 batches = 3 (2.5 rounded up)", () => {
    expect(need(1.25, 0).SACHET).toBe(3);
  });
  it("kg is exact to 1 mg (no floating-point dust)", () => {
    expect(need(3, 7).FOIL).toBe(0.0035);
    expect(need(0.001, 0).CULT).toBeUndefined(); // 0.4 µg is below 1 mg → nothing taken
  });
  it("no cartons when the product isn't packed in cartons", () => {
    expect(needsFor({ ...recipe, piecesPerCarton: null }, 1, 100).some((n) => n.componentId === "CARTON")).toBe(false);
    expect(cartonsFor(25, 12)).toBe(3);
    expect(cartonsFor(24, 12)).toBe(2);
  });
  it("cartons + loose pieces for display never double count", () => {
    expect(cartonSplit(1480, 12)).toEqual({ cartons: 123, loose: 4 });
    expect(cartonSplit(10, null)).toBeNull();
  });
  it("loss: expected pieces from the batches minus pieces produced", () => {
    expect(lossOf(2, 1850, 950)).toEqual({ expected: 1900, lost: 50, pct: 2.63 });
    expect(lossOf(1, 960, 950)).toEqual({ expected: 950, lost: -10, pct: -1.05 });
    expect(lossOf(1, 900, null)).toBeNull();
  });
  it("the spec's example: 100 cups need 100 containers", () => {
    const r = { piecesPerCarton: null, components: [
      { qty: 10, per: "BATCH" as const, component: c("MILK", "kg") }, { qty: 0.5, per: "BATCH" as const, component: c("SUGAR", "kg") }, { qty: 1, per: "PIECE" as const, component: c("CONT", "pcs") },
    ] };
    expect(Object.fromEntries(needsFor(r, 1, 100).map((n) => [n.componentId, n.qty]))).toEqual({ MILK: 10, SUGAR: 0.5, CONT: 100 });
  });
  it("shows kg amounts below 1 kg in grams", () => {
    expect(fmtAmount(0.0004, "kg")).toBe("0.4 g");
    expect(fmtAmount(520, "kg")).toBe("520 kg");
    expect(fmtAmount(1200, "pcs")).toBe("1,200 pcs");
  });
});

describe("dairy permissions", () => {
  it("has no machine, mold, service, maintenance or QC permissions", () => {
    expect(ALL_PERMISSIONS.some((p) => /^(assets|service|maintenance|qc):/.test(p))).toBe(false);
    expect(DEFAULT_ROLES.map((r) => r.name)).toEqual(["Administrator", "Accountant", "Sales Manager", "Production Team", "Warehouse Team"]);
  });
  it("the warehouse records in / out but has nothing that shows money", () => {
    const w = role("Warehouse Team");
    expect(w).toEqual(expect.arrayContaining(["stock:input", "stock:output", "warehouse:view", "warehouse:export"]));
    for (const p of ["stock:buy", "stock:sell", "cash:view", "customers:view", "products:edit"]) expect(w).not.toContain(p);
  });
  it("the accountant sees money: buy, sell, safes, customers, audit", () => {
    expect(role("Accountant")).toEqual(expect.arrayContaining(["stock:buy", "stock:sell", "cash:view", "customers:view", "reports:export", "audit:view", "warehouse:view"]));
  });
  it("production enters production only", () => {
    expect(role("Production Team")).toEqual(expect.arrayContaining(["production:create", "production:edit"]));
    expect(role("Production Team")).not.toContain("stock:output");
  });
});

describe("production days", () => {
  it("stores a factory day as midnight UTC of that date", () => {
    expect(dayValue("2026-10-23").toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(ymdOf(dayValue("2026-02-28"))).toBe("2026-02-28");
  });
  it("rejects anything that isn't YYYY-MM-DD", () => {
    expect(() => dayValue("23/10/2026")).toThrow();
  });
});

describe("packaging: pieces in one (PACK) — the Bereket FMS carton rule", () => {
  const carton = { id: "c", code: "CTN", name: "Carton", unit: "pcs" };
  const cup = { id: "u", code: "CUP", name: "Cup", unit: "pcs" };
  it("1,400 pieces with 12 in one carton take 117 cartons (a started carton counts)", () => {
    const n = needsFor({ components: [{ qty: 12, per: "PACK", component: carton }, { qty: 1, per: "PIECE", component: cup }] }, 1, 1400);
    expect(n.find((x) => x.code === "CTN")?.qty).toBe(117);
    expect(n.find((x) => x.code === "CUP")?.qty).toBe(1400);
  });
  it("exact multiples are not rounded up; nothing made, nothing used", () => {
    expect(needsFor({ components: [{ qty: 24, per: "PACK", component: carton }] }, 1, 480)[0].qty).toBe(20);
    expect(needsFor({ components: [{ qty: 24, per: "PACK", component: carton }] }, 1, 0)).toEqual([]);
  });
});
