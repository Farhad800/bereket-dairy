"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { audit, diff } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { run, UserError } from "@/lib/action";

const code = z.string().trim().max(40).regex(/^[A-Za-z0-9._\-/]*$/, "Letters, numbers, - _ . / only");
const six = (n: number) => Math.abs(n * 1e6 - Math.round(n * 1e6)) < 1e-3;

// ───────── A product's recipe ─────────
// BATCH lines: amount of the item in ONE batch (kg items in kg — the form converts grams — or pieces).
// PIECE lines: amount per piece produced (cups, lids, labels…).
// CARTON lines: amount per carton packed (cartons, tape…) — needs the product's pieces per carton.
const linesSchema = z.array(z.object({
  componentId: z.string().min(1, "Choose the item").max(40),
  qty: z.coerce.number().positive("More than 0").max(100_000_000).refine(six, "At most 6 decimals (1 mg)"),
  per: z.enum(["BATCH", "PIECE", "CARTON"]),
})).max(80);
type Lines = z.infer<typeof linesSchema>;

const detailsSchema = z.object({
  code: code.optional(),
  name: z.string().trim().min(2, "Type the product's name").max(160),
  name2: z.string().trim().max(160).optional(),
  specifications: z.string().trim().max(2000).optional(),
  batchYield: z.coerce.number().int("Whole pieces").positive("More than 0").max(10_000_000).optional(),
  piecesPerCarton: z.coerce.number().int("Whole pieces").positive("More than 0").max(1_000_000).optional(),
});

function checkLines(lines: Lines, productId?: string) {
  const seen = new Set<string>();
  for (const l of lines) {
    const k = `${l.componentId}|${l.per}`;
    if (seen.has(k)) throw new UserError("The same item is listed twice in the same part of the recipe. Put it on one line.");
    seen.add(k);
    if (productId && l.componentId === productId) throw new UserError("A product can't be made of itself.");
  }
}

async function writeRecipe(tx: Prisma.TransactionClient, productId: string, piecesPerCarton: number | null, lines: Lines, userId: string) {
  const comps = await tx.product.findMany({ where: { id: { in: lines.map((l) => l.componentId) } }, select: { id: true, code: true, kind: true, unit: true } });
  if (comps.length !== new Set(lines.map((l) => l.componentId)).size) throw new UserError("One of the items no longer exists. Reload the page.");
  for (const l of lines) {
    const c = comps.find((x) => x.id === l.componentId)!;
    if (c.kind !== "MATERIAL") throw new UserError(`${c.code} is a finished product. A recipe uses ingredients and production items only.`);
    if (l.per === "CARTON" && !piecesPerCarton) throw new UserError("Set how many pieces go into one carton before adding items per carton.");
  }
  await tx.productComponent.deleteMany({ where: { productId } });
  if (lines.length) await tx.productComponent.createMany({ data: lines.map((l) => ({ productId, componentId: l.componentId, qty: l.qty, per: l.per })) });
  const c = (id: string) => comps.find((x) => x.id === id)!;
  await audit({
    userId, action: "product.recipe", entityType: "Product", entityId: productId,
    after: { lines: lines.map((l) => `${c(l.componentId).code} ${l.qty} ${c(l.componentId).unit} per ${l.per.toLowerCase()}`) },
  }, tx);
}

async function freeCode(tx: Prisma.TransactionClient) {
  for (let i = 0; i < 50; i++) {
    const c = await nextNumber("itemProduct", tx);
    if (!(await tx.product.count({ where: { code: c } }))) return c;
  }
  throw new UserError("Couldn't find a free code. Type one yourself.");
}

/** New finished product in one go: details, batch yield, optional carton size and its recipe. */
export async function createProductAction(input: unknown) {
  const res = await run(async () => {
    const me = await requirePermission("products:create");
    const v = detailsSchema.extend({ lines: linesSchema }).parse(input);
    checkLines(v.lines);
    const p = await db.$transaction(async (tx) => {
      if (await tx.product.findFirst({ where: { kind: "PRODUCT", archivedAt: null, name: { equals: v.name, mode: "insensitive" } } })) throw new UserError("A product with this name already exists.");
      const c = v.code ? v.code.toUpperCase() : await freeCode(tx);
      if (await tx.product.count({ where: { code: c } })) throw new UserError(`The code ${c} is already used by another item.`);
      const created = await tx.product.create({
        data: {
          code: c, kind: "PRODUCT", unit: "pcs", name: v.name, name2: v.name2 || null, specifications: v.specifications || null,
          batchYield: v.batchYield ?? null, piecesPerCarton: v.piecesPerCarton ?? null,
        },
      });
      await audit({ userId: me.id, action: "product.create", entityType: "Product", entityId: created.id, after: { code: created.code, name: created.name, batchYield: created.batchYield, piecesPerCarton: created.piecesPerCarton } }, tx);
      await writeRecipe(tx, created.id, created.piecesPerCarton, v.lines, me.id);
      await notify({ type: "product.added", data: { name: created.name, code: created.code, by: me.fullName }, link: `/products/${created.id}`, toPermission: "products:view", exceptUserId: me.id }, tx);
      return created;
    });
    revalidatePath("/products");
    return p.id;
  });
  if (res.ok) redirect(`/products/${res.data}?created=1`);
  return res;
}

/** Saves the product page: details (when sent) and the recipe. */
export async function saveProductPageAction(input: unknown) {
  return run(async () => {
    const me = await requirePermission("products:edit");
    const v = z.object({ productId: z.string().min(1).max(40), lines: linesSchema, details: detailsSchema.optional() }).parse(input);
    checkLines(v.lines, v.productId);
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: v.productId }, select: { kind: true, code: true, name: true, name2: true, specifications: true, batchYield: true, piecesPerCarton: true } });
      if (p.kind !== "PRODUCT") throw new UserError("Only finished products have a recipe.");
      let ppc = p.piecesPerCarton;
      if (v.details) {
        const d = v.details;
        const c = d.code ? d.code.toUpperCase() : p.code;
        if (c !== p.code && (await tx.product.count({ where: { code: c, id: { not: v.productId } } }))) throw new UserError(`The code ${c} is already used by another item.`);
        if (await tx.product.findFirst({ where: { id: { not: v.productId }, kind: "PRODUCT", archivedAt: null, name: { equals: d.name, mode: "insensitive" } } })) throw new UserError("A product with this name already exists.");
        const data = { code: c, name: d.name, name2: d.name2 || null, specifications: d.specifications || null, batchYield: d.batchYield ?? null, piecesPerCarton: d.piecesPerCarton ?? null };
        await tx.product.update({ where: { id: v.productId }, data });
        ppc = data.piecesPerCarton;
        const ch = diff(p as never, data as never);
        if (ch.changed) await audit({ userId: me.id, action: "product.update", entityType: "Product", entityId: v.productId, before: ch.before, after: ch.after }, tx);
      }
      await writeRecipe(tx, v.productId, ppc, v.lines, me.id);
    });
    revalidatePath(`/products/${v.productId}`);
    revalidatePath("/products");
  });
}

// ───────── Archive / restore / delete (never hard-delete records with history) ─────────
export async function setArchivedAction(kind: "product", id: string, archived: boolean) {
  return run(async () => {
    if (kind !== "product") throw new UserError("Unknown record type.");
    const me = await requirePermission("products:archive");
    const rec = await db.product.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit({ userId: me.id, action: `product.${archived ? "archive" : "restore"}`, entityType: "Product", entityId: id });
    await notify({
      type: `product.${archived ? "archived" : "restored"}`, data: { name: rec.name, code: rec.code, by: me.fullName },
      link: "/products", toPermission: "products:view", exceptUserId: me.id,
    });
    revalidatePath("/products");
  });
}

/**
 * Permanently deletes a product or item — only if nothing in the factory's history refers to it.
 * Records that were used are archived instead, so past orders, production and stock keep their meaning.
 */
export async function deleteMasterAction(kind: "product", id: string) {
  return run(async () => {
    if (kind !== "product") throw new UserError("Unknown record type.");
    const me = await requirePermission("products:archive");
    const used = (what: string) => {
      throw new UserError(`It can't be deleted because ${what}. Use Archive instead — it disappears from lists but history stays correct.`);
    };
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id } });
      if (await tx.orderLine.count({ where: { productId: id } })) used("it is on orders");
      if (await tx.productionEntry.count({ where: { productId: id } })) used("production was recorded for it");
      if (await tx.stockMovement.count({ where: { productId: id } })) used("it has stock movements");
      if (await tx.productComponent.count({ where: { componentId: id } })) used("a product's recipe uses it");
      await tx.product.delete({ where: { id } });
      await audit({ userId: me.id, action: "product.delete", entityType: "Product", entityId: id, before: { code: p.code, name: p.name } }, tx);
      await notify({ type: "product.removed", data: { name: p.name, code: p.code, by: me.fullName }, link: "/products", toPermission: "products:view", exceptUserId: me.id }, tx);
    });
    revalidatePath("/products");
  });
}
