"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { run, formObject, UserError } from "@/lib/action";
import { dayValue, todayYmd } from "@/lib/production";
import { lockItems, neverNegative, requireStock, stampNow } from "@/lib/stock";
import { RECIPE_SELECT, consumptionDiff, writeConsumption } from "@/lib/consumption";
import { lossOf, r6, type Recipe } from "@/lib/recipe-math";
import { lockEntry, once, submissionKey } from "@/lib/submission";

/**
 * Production (dairy, owner 28 Oct 2026): per run, the product, the batches made and the pieces that came out.
 * Ingredients are taken by batches, packaging by pieces / cartons. One shift.
 * STRICT: if any ingredient or packaging item is short, NOTHING is saved and every short item is named.
 */

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const batchesNum = z.coerce.number().positive("Batches must be more than 0").max(100_000)
  .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, "Batches: at most 3 decimals (e.g. 1.5)");
const piecesNum = z.coerce.number().int("Pieces must be a whole number").min(0).max(10_000_000);

function refresh() {
  for (const p of ["/production", "/production/daily", "/inventory", "/dashboard", "/products"]) revalidatePath(p);
}

export type SheetResult = { products: number; pieces: number; batches: number; lost: number | null };

/** Saves the production typed on the sheet — any number of products in one save, all or nothing. */
export async function saveDailyEntriesAction(_: unknown, fd: FormData) {
  return run(async (): Promise<SheetResult> => {
    const me = await requirePermission("production:create");
    const day = ymd.parse(fd.get("day"));
    if (day > todayYmd()) throw new UserError("You can't enter production for a future date.");
    const notes = z.string().trim().max(500).optional().parse((fd.get("notes") as string | null)?.trim() || undefined);
    const rows: { productId: string; batches: number; qty: number }[] = [];
    const ids = new Set<string>();
    for (const [key] of fd.entries()) {
      const m = /^(?:batches|qty)_([a-z0-9]{10,40})$/i.exec(key);
      if (m) ids.add(m[1]);
    }
    for (const id of ids) {
      const b = String(fd.get(`batches_${id}`) ?? "").trim(), q = String(fd.get(`qty_${id}`) ?? "").trim();
      if (!b && !q) continue;
      if (!b) throw new UserError("Type the batches made for every product you enter pieces for.");
      if (!q) throw new UserError("Type the pieces produced for every product you enter batches for (0 if the batch was lost).");
      const batches = batchesNum.parse(b), qty = piecesNum.parse(q);
      rows.push({ productId: id, batches, qty });
    }
    if (rows.length === 0) throw new UserError("Type the batches and pieces for at least one product.");
    if (rows.length > 300) throw new UserError("Save at most 300 products at a time.");

    const { result } = await once<SheetResult>(
      submissionKey(fd.get("submissionId")), me.id, "production.daily",
      async (tx) => {
        const products = await tx.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } }, select: RECIPE_SELECT });
        const byId = new Map(products.map((p) => [p.id, p]));
        for (const r of rows) {
          const p = byId.get(r.productId);
          if (!p || p.kind !== "PRODUCT" || p.archivedAt) throw new UserError("One of the products is archived or doesn't exist. Reload the page.");
          if (!p.components.some((c) => c.per === "BATCH")) throw new UserError(`${p.code} ${p.name} has no batch recipe yet. Add its ingredients on the product page first.`);
        }
        // Everything the whole sheet needs, added up per item.
        const diffs = await Promise.all(rows.map((r) => consumptionDiff(tx, byId.get(r.productId)! as unknown as Recipe, null, r.batches, r.qty)));
        const total = new Map<string, number>();
        for (const d of diffs) for (const [id, q] of d) total.set(id, r6((total.get(id) ?? 0) + q));
        // Hold every item touched, then check the real stock while holding them.
        await lockItems(tx, [...total.keys(), ...rows.map((r) => r.productId)]);
        await requireStock(tx, total, "Production blocked");

        let lostSum = 0, expectedAny = false;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i], p = byId.get(r.productId)!;
          const entry = await tx.productionEntry.create({ data: { day: dayValue(day), productId: r.productId, batches: r.batches, quantity: r.qty, expectedPerBatch: p.batchYield, notes: notes ?? null, createdById: me.id } });
          if (r.qty > 0) await tx.stockMovement.create({ data: { productId: r.productId, type: "PRODUCTION", qty: r.qty, entryId: entry.id, createdById: me.id, createdAt: stampNow() } });
          await writeConsumption(tx, entry.id, diffs[i], me.id, `${p.code} · ${day}`);
          const loss = lossOf(r.batches, r.qty, p.batchYield);
          if (loss) { lostSum += loss.lost; expectedAny = true; }
          await audit({ userId: me.id, action: "production.report", entityType: "ProductionEntry", entityId: entry.id, after: { day, product: p.code, batches: r.batches, pieces: r.qty, ...(loss ? { expected: loss.expected, lost: loss.lost, lossPct: loss.pct } : {}) } }, tx);
        }
        await neverNegative(tx, total.keys(), undefined, "Production blocked");
        const pieces = rows.reduce((s, r) => s + r.qty, 0), batches = r6(rows.reduce((s, r) => s + r.batches, 0));
        await notify({
          type: "production.saved", data: { pcs: pieces, products: rows.length, batches, day, by: me.fullName },
          link: `/production?day=${day}`, toPermission: "production:view", exceptUserId: me.id,
        }, tx);
        return { products: rows.length, pieces, batches, lost: expectedAny ? lostSum : null };
      },
      { timeout: 60_000 },
    );
    refresh();
    return result;
  });
}

const correctSchema = z.object({
  entryId: z.string().min(1),
  batches: z.coerce.number().min(0).max(100_000).refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, "Batches: at most 3 decimals"),
  quantity: piecesNum,
  reason: z.string().trim().min(3, "Please give a reason").max(500),
});

/**
 * Fixes a typing mistake in batches and/or pieces. 0 batches and 0 pieces removes the entry.
 * Stock is corrected with balancing movements — and refused if the new figures need more than is in stock,
 * or if pieces taken off have already left the warehouse.
 */
export async function correctEntryAction(_: unknown, fd: FormData) {
  return run(async () => {
    const me = await requirePermission("production:edit");
    const v = correctSchema.parse(formObject(fd));
    const removing = v.batches === 0 && v.quantity === 0;
    if (!removing && v.batches === 0) throw new UserError("Batches must be more than 0 (type 0 batches and 0 pieces to delete the entry).");
    await db.$transaction(async (tx) => {
      // Hold the entry first and read it afterwards, so two corrections at the same moment apply one after the other.
      if (!(await lockEntry(tx, v.entryId))) throw new UserError("Entry not found. It may have just been removed — reload the page.");
      const e = await tx.productionEntry.findUnique({ where: { id: v.entryId }, include: { product: { select: RECIPE_SELECT } } });
      if (!e) throw new UserError("Entry not found.");
      const before = { batches: Number(e.batches), qty: e.quantity };
      if (before.batches === v.batches && before.qty === v.quantity) throw new UserError("Nothing changed.");
      const diffs = await consumptionDiff(tx, e.product as unknown as Recipe, e.id, v.batches, v.quantity);
      const delta = v.quantity - e.quantity;
      const out = new Map([...diffs].filter(([, q]) => q > 0));
      if (delta < 0) out.set(e.productId, -delta); // pieces taken back off: they must still be in the warehouse
      await lockItems(tx, [...diffs.keys(), e.productId]);
      await requireStock(tx, out, "Correction blocked");

      if (delta !== 0) await tx.stockMovement.create({ data: { productId: e.productId, type: "PRODUCTION", qty: delta, entryId: removing ? null : e.id, reason: `Correction: ${v.reason}`, createdById: me.id, createdAt: stampNow() } });
      await writeConsumption(tx, e.id, diffs, me.id, `${e.product.code} · ${e.day.toISOString().slice(0, 10)} (correction)`);
      if (removing) {
        await tx.stockMovement.updateMany({ where: { entryId: e.id }, data: { entryId: null } });
        await tx.productionEntry.delete({ where: { id: e.id } });
      } else {
        await tx.productionEntry.update({ where: { id: e.id }, data: { batches: v.batches, quantity: v.quantity } });
      }
      await neverNegative(tx, [...diffs.keys(), e.productId], undefined, "Correction blocked");
      await audit({
        userId: me.id, action: removing ? "production.delete" : "production.correct", entityType: "ProductionEntry", entityId: e.id, reason: v.reason,
        before: { day: e.day.toISOString().slice(0, 10), product: e.product.code, batches: before.batches, pieces: before.qty }, after: { batches: v.batches, pieces: v.quantity },
      }, tx);
      const d = e.day.toISOString().slice(0, 10);
      await notify({
        type: removing ? "production.deleted" : "production.corrected",
        data: { product: e.product.code, before: e.quantity, after: v.quantity, day: d, by: me.fullName, reason: v.reason },
        link: `/production?day=${d}`, toPermission: "production:view", exceptUserId: me.id,
      }, tx);
    }, { timeout: 60_000 });
    refresh();
  });
}
