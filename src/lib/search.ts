import "server-only";
import type { Tone } from "@/components/ui";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import type { Permission } from "./permissions";
import { ORDER_TONE } from "./tones";

export type Hit = {
  title: string; // record number / code
  sub?: string;
  href: string;
  status?: { ns: string; value: string; tone: Tone };
  exact: boolean; // the query is exactly this record's number or code
};
export type SearchGroup = { kind: string; hits: Hit[] };

const TAKE = 8;
const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });
const same = (a: string | null | undefined, q: string) => !!a && a.toLowerCase() === q.toLowerCase();

/**
 * One search across orders, products and items, production runs, stock documents, customers and the safes.
 * Each group only runs if the user may view it.
 */
export async function globalSearch(raw: string, me: CurrentUser): Promise<SearchGroup[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const may = (p: Permission) => me.permissions.has(p);
  const skip = Promise.resolve([] as Hit[]);

  const tasks: [string, Promise<Hit[]>][] = [
    ["orders", !may("orders:view") ? skip : db.order.findMany({
      where: { OR: [{ number: ci(q) }, { lines: { some: { product: { OR: [{ code: ci(q) }, { name: ci(q) }] } } } }] },
      orderBy: { createdAt: "desc" }, take: TAKE,
      select: { id: true, number: true, status: true, _count: { select: { lines: true } } },
    }).then((r) => r.map((o) => ({
      title: o.number, sub: `${o._count.lines} products`, href: `/orders/${o.id}`,
      status: { ns: "status.order", value: o.status, tone: ORDER_TONE[o.status] }, exact: same(o.number, q),
    })))],
    ["products", !may("products:view") ? skip : db.product.findMany({
      where: { OR: [{ code: ci(q) }, { name: ci(q) }, { name2: ci(q) }] }, orderBy: { code: "asc" }, take: TAKE, select: { id: true, code: true, name: true, name2: true, kind: true },
    }).then((r) => r.map((p) => ({
      title: p.code, sub: [p.name, p.name2].filter(Boolean).join(" · "),
      href: p.kind === "PRODUCT" ? `/production?product=${encodeURIComponent(p.code)}` : `/products/${p.id}`,
      exact: same(p.code, q),
    })))],
    ["production", !may("production:view") ? skip : db.productionEntry.findMany({
      where: { product: { OR: [{ code: ci(q) }, { name: ci(q) }] } }, orderBy: { createdAt: "desc" }, take: TAKE,
      select: { day: true, quantity: true, batches: true, product: { select: { code: true, name: true } } },
    }).then((r) => r.map((e) => ({ title: `${e.product.code} · ${e.day.toISOString().slice(0, 10)}`, sub: `${Number(e.batches)} × batch → ${e.quantity.toLocaleString("en")} pcs`, href: `/production?day=${e.day.toISOString().slice(0, 10)}`, exact: false })))],
    ["stockDocs", !may("stock:view") ? skip : db.stockDoc.findMany({
      where: { OR: [{ number: ci(q) }, { party: ci(q) }, { invoiceNo: ci(q) }, { supplierRef: ci(q) }, { reference: ci(q) }] }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, number: true, party: true, invoiceNo: true, supplierRef: true, reference: true },
    }).then((r) => r.map((d) => ({ title: d.number, sub: [d.party, d.invoiceNo, d.supplierRef, d.reference].filter(Boolean).join(" · "), href: `/stock/${d.id}`, exact: same(d.number, q) || same(d.reference, q) })))],
    ["customers", !(may("customers:view") && (may("stock:buy") || may("stock:sell") || may("cash:view"))) ? skip : db.customer.findMany({
      where: { OR: [{ code: ci(q) }, { name: ci(q) }, { phone: { contains: q } }] }, orderBy: { code: "asc" }, take: TAKE, select: { id: true, code: true, name: true, phone: true },
    }).then((r) => r.map((c) => ({ title: `${c.code} · ${c.name}`, sub: c.phone ?? "", href: `/customers/${c.id}`, exact: same(c.code, q) })))],
    ["cashEntries", !may("cash:view") ? skip : db.cashEntry.findMany({
      where: { OR: [{ number: ci(q) }, { party: ci(q) }, { note: ci(q) }] }, orderBy: [{ number: "desc" }, { amount: "asc" }], distinct: ["number"], take: TAKE, // an exchange is two entries with one number select: { id: true, number: true, party: true, note: true, amount: true, currency: true },
    }).then((r) => r.map((e) => ({ title: e.number, sub: [`${Number(e.amount).toLocaleString("en", { maximumFractionDigits: 2 })} ${e.currency}`, e.party, e.note].filter(Boolean).join(" · "), href: `/cash/${e.id}`, exact: same(e.number, q) })))],
  ];

  const results = await Promise.all(tasks.map(([, p]) => p));
  return tasks.map(([kind], i) => ({ kind, hits: results[i] })).filter((g) => g.hits.length > 0);
}
