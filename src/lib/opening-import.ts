import "server-only";
import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { stampNow } from "@/lib/stock";
import { round6 } from "@/lib/money";

/**
 * One-time load of the factory's item list and the stock on the shelf when the system starts
 * (owner's request, 28 Oct 2026). Creates every item, then one Input document per section with
 * reason "Opening stock" — the same records a person saving an Input document makes.
 * It runs once: a marker in Settings blocks a second run, and it refuses if any of the codes already exist.
 */
export const MARKER = "import.openingStock";

const item = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9._\-/]+$/),
  name: z.string().trim().min(2).max(160),
  name2: z.string().trim().max(160).nullable().optional(),
  section: z.enum(["PRODUCT", "RAW", "PACKAGING"]),
  unit: z.enum(["pcs", "kg"]),
  piecesPerCarton: z.number().int().positive().max(100_000).nullable().optional(),
  qty: z.number().min(0).max(1_000_000_000),
  costIqd: z.number().min(0).max(1_000_000_000).nullable().optional(),
});
export const payloadSchema = z.object({
  by: z.string().trim().min(1).max(60).optional(), // username the documents are recorded under; empty = the first administrator
  source: z.string().trim().min(1).max(120), // e.g. the file name
  items: z.array(item).min(1).max(5000),
});
export type Payload = z.infer<typeof payloadSchema>;

export class ImportRefused extends Error {}

export async function importOpeningStock(p: Payload, dryRun: boolean) {
  const run = async (tx: Tx) => {
    if (await tx.setting.findUnique({ where: { key: MARKER } })) throw new ImportRefused("The opening stock was already imported. Nothing was changed.");
    const me = await tx.user.findFirst({ where: { active: true, ...(p.by ? { username: p.by } : { role: { name: "Administrator" } }) }, orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, role: { select: { permissions: { select: { permission: true } } } } } });
    const perms = new Set(me?.role.permissions.map((x) => x.permission) ?? []);
    if (!me || !perms.has("stock:input") || !perms.has("products:create")) throw new ImportRefused(`User ${p.by ?? "(first administrator)"} not found or not allowed to add items and stock.`);
    const codes = p.items.map((i) => i.code.toUpperCase());
    if (new Set(codes).size !== codes.length) throw new ImportRefused("The same code is on two rows.");
    const taken = await tx.product.findMany({ where: { code: { in: codes } }, select: { code: true } });
    if (taken.length) throw new ImportRefused(`These codes already exist, nothing was changed: ${taken.map((t) => t.code).join(", ")}`);
    for (const i of p.items) {
      if (i.unit === "pcs" && !Number.isInteger(i.qty)) throw new ImportRefused(`${i.code} is counted in pieces — whole numbers only (${i.qty}).`);
      if (i.section !== "PRODUCT" && i.piecesPerCarton) throw new ImportRefused(`${i.code}: pieces per carton is for finished products.`);
    }

    await tx.product.createMany({
      data: p.items.map((i) => ({
        code: i.code.toUpperCase(), name: i.name, name2: i.name2 || null, unit: i.section === "PRODUCT" ? "pcs" : i.unit,
        kind: i.section === "PRODUCT" ? "PRODUCT" as const : "MATERIAL" as const,
        materialGroup: i.section === "PRODUCT" ? null : i.section,
        piecesPerCarton: i.section === "PRODUCT" ? i.piecesPerCarton ?? null : null,
        ...(i.section !== "PRODUCT" && i.costIqd != null ? { costPrice: round6(i.costIqd), costCurrency: "IQD" as const, costRate: 1, costIqd: round6(i.costIqd), costUpdatedAt: new Date() } : {}),
      })),
    });
    const ids = new Map((await tx.product.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } })).map((r) => [r.code, r.id]));
    await audit({ userId: me.id, action: "product.import", entityType: "Product", entityId: null, reason: `Opening item list from ${p.source}`,
      after: { products: p.items.filter((i) => i.section === "PRODUCT").length, rawMaterials: p.items.filter((i) => i.section === "RAW").length, packaging: p.items.filter((i) => i.section === "PACKAGING").length } }, tx);

    const docs: { section: string; number: string; lines: number }[] = [];
    for (const section of ["PRODUCT", "RAW", "PACKAGING"] as const) {
      const lines = p.items.filter((i) => i.section === section && i.qty > 0).map((i) => ({ ...i, qty: i.unit === "kg" ? round6(i.qty) : i.qty }));
      if (!lines.length) continue;
      const number = await nextNumber("stockInput", tx);
      const note = `Opening stock — ${section === "PRODUCT" ? "finished products" : section === "RAW" ? "raw materials" : "packaging"} (${p.source})`;
      const doc = await tx.stockDoc.create({ data: { number, type: "INPUT", reason: "OPENING", reference: p.source.slice(0, 60), party: null, note, createdById: me.id } });
      const at = stampNow();
      await tx.stockMovement.createMany({
        data: lines.map((l) => ({ productId: ids.get(l.code.toUpperCase())!, type: "INPUT" as const, qty: l.qty, docId: doc.id, reference: number, createdAt: at, unitPrice: null, reason: note, createdById: me.id })),
      });
      await audit({ userId: me.id, action: "stock.input", entityType: "StockDoc", entityId: doc.id, reason: note,
        after: { number, reason: "OPENING", reference: p.source, lines: lines.length } }, tx);
      docs.push({ section, number, lines: lines.length });
    }
    await tx.setting.create({ data: { key: MARKER, value: { at: new Date().toISOString(), by: me.fullName, source: p.source, items: p.items.length, docs } as never } });
    const summary = { items: p.items.length, created: ids.size, docs };
    if (dryRun) throw new DryRun(summary);
    return summary;
  };
  try {
    return { dryRun: false, ...(await db.$transaction(run, { timeout: 120_000, maxWait: 20_000 })) };
  } catch (e) {
    if (e instanceof DryRun) return { dryRun: true, ...e.summary };
    throw e;
  }
}

class DryRun extends Error {
  constructor(public summary: { items: number; created: number; docs: { section: string; number: string; lines: number }[] }) { super("dry run"); }
}

/**
 * The opening-stock CSV (UTF-8, header row). Columns by name, any order; extra columns are ignored:
 * section (PRODUCT | RAW | PACKAGING), code, name, name2, unit (pcs | kg), pieces_per_carton, quantity, cost_iqd
 */
export function payloadFromCsv(rows: string[][], by: string, source: string): Payload {
  if (rows.length < 2) throw new ImportRefused("The file has no rows.");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  for (const n of ["section", "code", "name", "unit", "quantity"]) if (col(n) < 0) throw new ImportRefused(`The file needs a "${n}" column.`);
  const get = (r: string[], n: string) => (col(n) < 0 ? "" : (r[col(n)] ?? "").trim());
  const num = (v: string, line: number, what: string) => {
    if (v === "") return null;
    const x = Number(v.replace(/,/g, ""));
    if (!Number.isFinite(x)) throw new ImportRefused(`Row ${line}: ${what} "${v}" is not a number.`);
    return x;
  };
  const items = rows.slice(1).map((r, i) => {
    const line = i + 2;
    const ppc = num(get(r, "pieces_per_carton"), line, "pieces per carton");
    return {
      section: get(r, "section").toUpperCase() as "PRODUCT" | "RAW" | "PACKAGING",
      code: get(r, "code"), name: get(r, "name"), name2: get(r, "name2") || null,
      unit: get(r, "unit").toLowerCase() as "pcs" | "kg",
      piecesPerCarton: ppc === null ? null : ppc,
      qty: num(get(r, "quantity"), line, "quantity") ?? 0,
      costIqd: num(get(r, "cost_iqd"), line, "cost"),
    };
  });
  const parsed = payloadSchema.safeParse({ by, source, items });
  if (!parsed.success) {
    const e = parsed.error.issues[0];
    const row = typeof e.path[1] === "number" ? ` (row ${e.path[1] + 2}, ${String(e.path[2] ?? "")})` : "";
    throw new ImportRefused(`The file has a mistake${row}: ${e.message}`);
  }
  return parsed.data;
}
