import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { factoryDay, parseFactoryDate, toFactoryDateInput } from "@/lib/time";
import { MOVE_TONE, ORDER_TONE } from "@/lib/tones";
import { lossOf } from "@/lib/recipe-math";
import type { ReportDef, ReportQuery, Row } from "./types";
import { lineTotal } from "@/lib/money";
import { canSeeMoney } from "@/lib/auth";

// ─────────────────────────────────────────────────────────── helpers
const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const MAX_ROWS = 5000;
/** ProductionEntry.day is a DATE: compare with the factory calendar day strings. */
const dayRange = (q: ReportQuery) => ({ gte: new Date(`${q.from}T00:00:00Z`), lte: new Date(`${q.to}T00:00:00Z`) });

async function userNames() {
  const users = await db.user.findMany({ select: { id: true, fullName: true } });
  const m = new Map(users.map((u) => [u.id, u.fullName]));
  return (id: string | null | undefined) => (id ? m.get(id) ?? "—" : "—");
}
const unitOf = (u: string) => (u.toLowerCase() === "kg" ? "kg" : "pcs");

// ─────────────────────────────────────────────────────────── reports
export const REPORTS: ReportDef[] = [
  // 1 ─ Production by day / week / month / product: batches, pieces, expected and lost
  {
    key: "production",
    section: "production",
    icon: "Factory",
    filters: ["range", "group", "product"],
    groups: ["day", "week", "month", "product"],
    async run(q) {
      const g = q.group ?? "day";
      const list = await db.productionEntry.findMany({
        where: { day: dayRange(q), ...(q.product ? { productId: q.product } : {}) },
        select: { day: true, quantity: true, batches: true, expectedPerBatch: true, productId: true, product: { select: { code: true, name: true } } },
      });
      const key = (e: (typeof list)[number]) => {
        const d = e.day.toISOString().slice(0, 10);
        if (g === "product") return `${e.product.code} · ${e.product.name}`;
        if (g === "month") return d.slice(0, 7);
        if (g === "week") { const t = Date.parse(`${d}T00:00:00Z`); const wd = (new Date(t).getUTCDay() + 6) % 7; return new Date(t - wd * DAY).toISOString().slice(0, 10); }
        return d;
      };
      const groups = new Map<string, { label: string; batches: number; pcs: number; expected: number; lost: number; entries: number; products: Set<string> }>();
      for (const e of list) {
        const k = key(e);
        const c = groups.get(k) ?? { label: k, batches: 0, pcs: 0, expected: 0, lost: 0, entries: 0, products: new Set<string>() };
        const l = lossOf(Number(e.batches), e.quantity, e.expectedPerBatch);
        c.batches = Math.round((c.batches + Number(e.batches)) * 1000) / 1000; c.pcs += e.quantity; c.entries++; c.products.add(e.productId);
        if (l) { c.expected += l.expected; c.lost += l.lost; }
        groups.set(k, c);
      }
      let out: Row[] = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)).map((c) => ({
        label: c.label, batches: c.batches, pcs: c.pcs, expected: c.expected || null, lost: c.expected ? c.lost : null, lossPct: pct(c.lost, c.expected), entries: c.entries, products: c.products.size,
      }));
      if (g === "day") {
        const have = new Map(out.map((r) => [r.label, r]));
        out = [];
        for (let t = Date.parse(`${q.from}T00:00:00Z`); t <= Date.parse(`${q.to}T00:00:00Z`) && out.length < 400; t += DAY) {
          const d = new Date(t).toISOString().slice(0, 10);
          out.push(have.get(d) ?? { label: d, batches: 0, pcs: 0, expected: null, lost: null, lossPct: null, entries: 0, products: 0 });
        }
      }
      if (g === "product") out.sort((a, b) => num(b.pcs) - num(a.pcs));
      const pcs = sum(out, (r) => num(r.pcs)), expected = sum(out, (r) => num(r.expected)), lost = sum(out, (r) => num(r.lost));
      const days = Math.max(1, Math.round((Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / DAY) + 1);
      return {
        columns: [
          { key: "label", label: `rep.group.${g}` },
          { key: "batches", label: "rep.col.batches", type: "qty", total: true },
          { key: "pcs", label: "rep.col.produced", type: "int", total: true },
          { key: "expected", label: "rep.col.expected", type: "int", total: true, wide: true },
          { key: "lost", label: "rep.col.lost", type: "int", total: true },
          { key: "lossPct", label: "rep.col.lossPct", type: "pct" },
          { key: "entries", label: "rep.col.entries", type: "int", total: true, wide: true },
          ...(g === "product" ? [] : [{ key: "products", label: "rep.col.products", type: "int" as const, wide: true }]),
        ],
        rows: out,
        totals: true,
        chart: { label: "label", value: "pcs" },
        kpis: [
          { label: "rep.kpi.producedPcs", value: pcs, type: "int" },
          { label: "rep.kpi.batches", value: Math.round(sum(out, (r) => num(r.batches)) * 1000) / 1000, type: "int" },
          { label: "rep.kpi.lostPcs", value: expected ? lost : null, type: "int", tone: lost > 0 ? "warn" : undefined },
          { label: "rep.kpi.lossRate", value: pct(lost, expected), type: "pct" },
          { label: "rep.kpi.avgPerDay", value: Math.round(pcs / days), type: "int" },
        ],
      };
    },
  },

  // 2 ─ Every production run
  {
    key: "production-entries",
    section: "production",
    icon: "ListChecks",
    filters: ["range", "product", "employee"],
    async run(q) {
      const name = await userNames();
      const list = await db.productionEntry.findMany({
        where: { day: dayRange(q), ...(q.product ? { productId: q.product } : {}), ...(q.employee ? { createdById: q.employee } : {}) },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
        take: MAX_ROWS,
        include: { product: true },
      });
      const rows: Row[] = list.map((e) => {
        const l = lossOf(Number(e.batches), e.quantity, e.expectedPerBatch);
        return {
          day: e.day.toISOString().slice(0, 10), product: `${e.product.code} · ${e.product.name}`, batches: Number(e.batches), qty: e.quantity,
          expected: l?.expected ?? null, lost: l?.lost ?? null, lossPct: l?.pct ?? null, by: name(e.createdById), notes: e.notes ?? "",
          _href: { day: `/production?day=${e.day.toISOString().slice(0, 10)}` },
        };
      });
      const expected = sum(rows, (r) => num(r.expected)), lost = sum(rows, (r) => num(r.lost));
      return {
        columns: [
          { key: "day", label: "rep.col.day", type: "code" },
          { key: "product", label: "rep.col.product" },
          { key: "batches", label: "rep.col.batches", type: "qty", total: true },
          { key: "qty", label: "rep.col.produced", type: "int", total: true },
          { key: "expected", label: "rep.col.expected", type: "int", total: true, wide: true },
          { key: "lost", label: "rep.col.lost", type: "int", total: true },
          { key: "lossPct", label: "rep.col.lossPct", type: "pct" },
          { key: "by", label: "rep.col.by", wide: true },
          { key: "notes", label: "rep.col.note", wide: true },
        ],
        rows,
        totals: true,
        kpis: [
          { label: "rep.kpi.entries", value: rows.length, type: "int" },
          { label: "rep.kpi.producedPcs", value: sum(rows, (r) => num(r.qty)), type: "int" },
          { label: "rep.kpi.lostPcs", value: expected ? lost : null, type: "int", tone: lost > 0 ? "warn" : undefined },
          { label: "rep.kpi.lossRate", value: pct(lost, expected), type: "pct" },
        ],
      };
    },
  },

  // 3 ─ What production used: ingredients and packaging taken from stock (quantities only)
  {
    key: "consumption",
    section: "production",
    icon: "FlaskConical",
    filters: ["range", "item"],
    async run(q) {
      const used = await db.stockMovement.groupBy({
        by: ["productId"],
        where: { type: "USE", createdAt: { gte: q.start, lt: q.end }, ...(q.item ? { productId: q.item } : {}) },
        _sum: { qty: true },
      });
      const items = await db.product.findMany({ where: { id: { in: used.map((u) => u.productId) } }, select: { id: true, code: true, name: true, unit: true } });
      const rows: Row[] = items.map((it) => ({
        item: `${it.code} · ${it.name}`, used: r6(-num(used.find((u) => u.productId === it.id)?._sum.qty)), unit: unitOf(it.unit),
        _href: { item: `/products/${it.id}` },
      })).sort((a, b) => String(a.item).localeCompare(String(b.item)));
      return {
        columns: [
          { key: "item", label: "rep.col.item" },
          { key: "used", label: "rep.col.used", type: "qty" },
          { key: "unit", label: "rep.col.unit" },
        ],
        rows,
        kpis: [{ label: "rep.kpi.itemsUsed", value: rows.length, type: "int" }],
      };
    },
  },

  // 3 ─ Orders
  {
    key: "orders",
    section: "orders",
    icon: "ClipboardCheck",
    filters: ["range", "status", "product"],
    statusFilter: { ns: "status.order", values: ["OPEN", "COMPLETED", "CANCELLED"] },
    async run(q) {
      const name = await userNames();
      const orders = await db.order.findMany({
        where: {
          createdAt: { gte: q.start, lt: q.end },
          ...(q.status ? { status: q.status as never } : {}),
          ...(q.product ? { lines: { some: { productId: q.product } } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS,
        include: { lines: { select: { quantity: true } } },
      });
      const rows: Row[] = orders.map((o) => ({
        order: o.number, created: o.createdAt, status: o.status, products: o.lines.length, pieces: sum(o.lines, (l) => l.quantity),
        completed: o.completedAt, by: name(o.createdById), _href: { order: `/orders/${o.id}` },
      }));
      return {
        columns: [
          { key: "order", label: "rep.col.order", type: "code" },
          { key: "created", label: "rep.col.created", type: "date" },
          { key: "status", label: "rep.col.status", type: "status", ns: "status.order", tones: ORDER_TONE },
          { key: "products", label: "rep.col.products", type: "int", total: true },
          { key: "pieces", label: "rep.col.ordered", type: "int", total: true },
          { key: "completed", label: "rep.col.completed", type: "date", wide: true },
          { key: "by", label: "rep.col.by", wide: true },
        ],
        rows,
        totals: true,
        kpis: [
          { label: "rep.kpi.orders", value: rows.length, type: "int" },
          { label: "rep.kpi.stillOpen", value: rows.filter((r) => r.status === "OPEN").length, type: "int" },
          { label: "rep.kpi.orderedPcs", value: sum(rows, (r) => num(r.pieces)), type: "int" },
        ],
      };
    },
  },

  // 4 ─ What open orders still need, against stock and recent production
  {
    key: "demand",
    section: "orders",
    icon: "Target",
    filters: ["range", "product"],
    async run(q) {
      const [demand, stock, made] = await Promise.all([
        db.orderLine.groupBy({ by: ["productId"], where: { order: { status: "OPEN" }, ...(q.product ? { productId: q.product } : {}) }, _sum: { quantity: true }, _count: { orderId: true } }),
        db.stockMovement.groupBy({ by: ["productId"], _sum: { qty: true } }),
        db.productionEntry.groupBy({ by: ["productId"], where: { day: dayRange(q) }, _sum: { quantity: true } }),
      ]);
      const products = await db.product.findMany({ where: { id: { in: demand.map((d) => d.productId) } }, select: { id: true, code: true, name: true } });
      const rows: Row[] = demand
        .map((d) => {
          const p = products.find((x) => x.id === d.productId)!;
          const ordered = d._sum.quantity ?? 0, inStock = Number(stock.find((s) => s.productId === d.productId)?._sum.qty ?? 0);
          return {
            product: `${p.code} · ${p.name}`, orders: d._count.orderId, ordered, stock: inStock,
            made: made.find((m) => m.productId === d.productId)?._sum.quantity ?? 0, short: Math.max(ordered - inStock, 0),
          };
        })
        .sort((a, b) => b.short - a.short);
      return {
        columns: [
          { key: "product", label: "rep.col.product" },
          { key: "orders", label: "rep.col.openOrders", type: "int", wide: true },
          { key: "ordered", label: "rep.col.ordered", type: "int", total: true },
          { key: "stock", label: "rep.col.inStock", type: "int", total: true },
          { key: "made", label: "rep.col.madeInPeriod", type: "int", total: true, wide: true },
          { key: "short", label: "rep.col.stillToMake", type: "int", total: true },
        ],
        rows,
        totals: true,
        chart: { label: "product", value: "short" },
        kpis: [
          { label: "rep.kpi.productsOrdered", value: rows.length, type: "int" },
          { label: "rep.kpi.orderedPcs", value: sum(rows, (r) => num(r.ordered)), type: "int" },
          { label: "rep.kpi.pcsToProduce", value: sum(rows, (r) => num(r.short)), type: "int", tone: "warn" },
        ],
      };
    },
  },

  // ─ The warehouse's daily in / out report: opening, in, out and closing stock per item, or every movement
  {
    key: "warehouse-daily",
    section: "warehouse",
    icon: "ArrowDownUp",
    filters: ["range", "group", "section", "item", "direction", "employee", "ref"],
    groups: ["item", "movement"],
    async run(q, ctx) {
      const name = await userNames();
      const itemWhere: Prisma.ProductWhereInput = { ...(q.section ? { kind: q.section } : {}), ...(q.item ? { id: q.item } : {}) };
      const refWhere: Prisma.StockMovementWhereInput = q.ref ? { OR: [
        { reference: { contains: q.ref, mode: "insensitive" } },
        { doc: { OR: [{ number: { contains: q.ref, mode: "insensitive" } }, { reference: { contains: q.ref, mode: "insensitive" } }, { invoiceNo: { contains: q.ref, mode: "insensitive" } }, { supplierRef: { contains: q.ref, mode: "insensitive" } }] } },
      ] } : {};
      const moveWhere: Prisma.StockMovementWhereInput = {
        createdAt: { gte: q.start, lt: q.end },
        product: itemWhere,
        ...(q.direction === "IN" ? { qty: { gt: 0 } } : q.direction === "OUT" ? { qty: { lt: 0 } } : {}),
        ...(q.employee ? { createdById: q.employee } : {}),
        ...refWhere,
      };
      const SECTION_TONE = { PRODUCT: "blue", MATERIAL: "gray" } as const;

      if (q.group === "movement") {
        const list = await db.stockMovement.findMany({
          where: moveWhere, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_ROWS,
          include: {
            product: { select: { id: true, code: true, name: true, unit: true, kind: true } },
            doc: { select: { id: true, number: true, reference: true, reason: true, party: true, invoiceNo: true, supplierRef: true, currency: true, rate: true } },
          },
        });
        const rows: Row[] = list.map((m) => {
          const qty = Number(m.qty);
          const price = m.unitPrice === null ? null : Number(m.unitPrice);
          return {
            at: m.createdAt, type: m.type, section: m.product.kind, item: `${m.product.code} · ${m.product.name}`,
            in: qty > 0 ? r6(qty) : null, out: qty < 0 ? r6(-qty) : null, unit: unitOf(m.product.unit),
            reason: m.doc?.reason ? m.doc.reason : m.type === "USE" || m.type === "PRODUCTION" ? `=${m.reason ?? ""}` : "",
            party: m.doc?.party ?? "", ref: [m.doc?.number, m.doc?.reference, m.doc?.supplierRef].filter(Boolean).join(" · "),
            by: name(m.createdById),
            // Money columns only for people who see money (never even in the data for anyone else).
            ...(ctx.money ? { price, currency: price !== null ? m.doc?.currency ?? "IQD" : "", value: price !== null ? Math.round(lineTotal(Math.abs(qty), price) * 100) / 100 : null } : {}),
            _href: { item: `/products/${m.product.id}`, ...(m.doc ? { ref: `/stock/${m.doc.id}` } : {}) },
          };
        });
        return {
          columns: [
            { key: "at", label: "rep.col.when", type: "datetime" },
            { key: "type", label: "rep.col.movement", type: "status", ns: "wh.mv", tones: MOVE_TONE },
            { key: "section", label: "rep.col.section", type: "status", ns: "md.kindPlural", tones: SECTION_TONE, wide: true },
            { key: "item", label: "rep.col.item" },
            { key: "in", label: "rep.col.in", type: "qty" },
            { key: "out", label: "rep.col.out", type: "qty" },
            { key: "unit", label: "rep.col.unit" },
            { key: "reason", label: "rep.col.reason", type: "status", ns: "sd.reason", wide: true },
            { key: "party", label: "rep.col.party", wide: true },
            { key: "ref", label: "rep.col.reference" },
            { key: "by", label: "rep.col.by", wide: true },
            ...(ctx.money ? [
              { key: "price", label: "rep.col.unitPrice", type: "qty" as const, wide: true },
              { key: "currency", label: "rep.col.currency", wide: true },
              { key: "value", label: "rep.col.amount", type: "int" as const },
            ] : []),
          ],
          rows,
          kpis: [
            { label: "rep.kpi.movements", value: rows.length, type: "int" },
            { label: "rep.kpi.inLines", value: rows.filter((r) => r.in !== null).length, type: "int" },
            { label: "rep.kpi.outLines", value: rows.filter((r) => r.out !== null).length, type: "int" },
          ],
        };
      }

      // Per item: opening (before the period), in and out during it, closing (end of the period) — from the ledger.
      const items = await db.product.findMany({ where: { ...itemWhere, OR: [{ archivedAt: null }, { stockMovements: { some: {} } }] }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true, unit: true, kind: true } });
      const ids = items.map((i) => i.id);
      const [before, untilEnd, inQ, outQ] = await Promise.all([
        db.stockMovement.groupBy({ by: ["productId"], where: { productId: { in: ids }, createdAt: { lt: q.start } }, _sum: { qty: true } }),
        db.stockMovement.groupBy({ by: ["productId"], where: { productId: { in: ids }, createdAt: { lt: q.end } }, _sum: { qty: true } }),
        q.direction === "OUT" ? [] : db.stockMovement.groupBy({ by: ["productId"], where: { ...moveWhere, productId: { in: ids }, qty: { gt: 0 } }, _sum: { qty: true } }),
        q.direction === "IN" ? [] : db.stockMovement.groupBy({ by: ["productId"], where: { ...moveWhere, productId: { in: ids }, qty: { lt: 0 } }, _sum: { qty: true } }),
      ]);
      const get = (l: { productId: string; _sum: { qty: unknown } }[], id: string) => r6(num(l.find((x) => x.productId === id)?._sum.qty));
      const filtered = !!(q.direction || q.employee || q.ref);
      const rows: Row[] = items.map((it) => ({
        section: it.kind, item: `${it.code} · ${it.name}`, unit: unitOf(it.unit),
        opening: get(before, it.id), in: get(inQ, it.id), out: r6(-get(outQ, it.id)), closing: get(untilEnd, it.id),
        _href: { item: `/products/${it.id}` },
      })).filter((r) => !filtered || num(r.in) !== 0 || num(r.out) !== 0);
      return {
        columns: [
          { key: "section", label: "rep.col.section", type: "status", ns: "md.kindPlural", tones: SECTION_TONE, wide: true },
          { key: "item", label: "rep.col.item" },
          { key: "unit", label: "rep.col.unit" },
          { key: "opening", label: "rep.col.opening", type: "qty" },
          { key: "in", label: "rep.col.in", type: "qty" },
          { key: "out", label: "rep.col.out", type: "qty" },
          { key: "closing", label: "rep.col.closing", type: "qty" },
        ],
        rows,
        kpis: [
          { label: "rep.kpi.items", value: rows.length, type: "int" },
          { label: "rep.kpi.itemsWithIn", value: rows.filter((r) => num(r.in) > 0).length, type: "int" },
          { label: "rep.kpi.itemsWithOut", value: rows.filter((r) => num(r.out) > 0).length, type: "int" },
          { label: "rep.kpi.outOfStockAtEnd", value: rows.filter((r) => num(r.closing) <= 0).length, type: "int", tone: "warn" },
        ],
      };
    },
  },

  // ─ Buying and selling (Stock movements: Buy / Sell), per line with prices
  {
    key: "trade",
    section: "warehouse",
    money: true,
    icon: "ArrowLeftRight",
    filters: ["range", "product", "type"],
    typeFilter: { ns: "sd.type", values: ["BUY", "SELL"] },
    async run(q) {
      const list = await db.stockMovement.findMany({
        where: { type: q.type ? (q.type as never) : { in: ["BUY", "SELL"] }, createdAt: { gte: q.start, lt: q.end }, ...(q.product ? { productId: q.product } : {}) },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS,
        include: { product: { select: { code: true, name: true } }, doc: { select: { id: true, number: true, party: true, invoiceNo: true, currency: true, total: true, discount: true } } },
      });
      const rows: Row[] = list.map((m) => {
        const qty = Math.abs(Number(m.qty)), price = Number(m.unitPrice ?? 0);
        return {
          at: m.createdAt, doc: m.doc?.number ?? m.reference, type: m.type, party: m.doc?.party ?? "", invoice: m.doc?.invoiceNo ?? "",
          product: `${m.product.code} · ${m.product.name}`, qty, price, discount: Number(m.discount ?? 0) || null, total: Math.round((lineTotal(qty, price) - Number(m.discount ?? 0)) * 100) / 100, currency: m.doc?.currency ?? "",
          ...(m.doc ? { _href: { doc: `/stock/${m.doc.id}` } } : {}),
        };
      });
      // Totals per document (after invoice discounts), each document counted once.
      const docs = new Map(list.filter((m) => m.doc).map((m) => [m.doc!.id, { type: m.type, cur: m.doc!.currency ?? "", total: Number(m.doc!.total ?? 0) }]));
      // With one product chosen, its lines are what counts (invoice discounts can't be split per product).
      const tot = (type: string, cur: string) => Math.round((q.product
        ? sum(rows.filter((r) => r.type === type && r.currency === cur), (r) => num(r.total))
        : sum([...docs.values()].filter((d) => d.type === type && d.cur === cur), (d) => d.total)) * 100) / 100;
      return {
        columns: [
          { key: "at", label: "rep.col.when", type: "datetime" },
          { key: "doc", label: "rep.col.document", type: "code" },
          { key: "type", label: "rep.col.movement", type: "status", ns: "sd.type", tones: MOVE_TONE },
          { key: "party", label: "rep.col.party" },
          { key: "invoice", label: "rep.col.invoice", wide: true },
          { key: "product", label: "rep.col.product" },
          { key: "qty", label: "rep.col.qty", type: "qty" },
          { key: "price", label: "rep.col.unitPrice", type: "int", wide: true },
          { key: "discount", label: "rep.col.discount", type: "int", wide: true },
          { key: "total", label: "rep.col.amount", type: "int" },
          { key: "currency", label: "rep.col.currency" },
        ],
        rows,
        kpis: [
          { label: "rep.kpi.boughtIqd", value: tot("BUY", "IQD"), type: "int" },
          { label: "rep.kpi.boughtUsd", value: tot("BUY", "USD"), type: "int" },
          { label: "rep.kpi.soldIqd", value: tot("SELL", "IQD"), type: "int", tone: "good" },
          { label: "rep.kpi.soldUsd", value: tot("SELL", "USD"), type: "int", tone: "good" },
          ...(rows.some((r) => r.currency === "EUR") ? [
            { label: "rep.kpi.boughtEur", value: tot("BUY", "EUR"), type: "int" as const },
            { label: "rep.kpi.soldEur", value: tot("SELL", "EUR"), type: "int" as const, tone: "good" as const },
          ] : []),
        ],
      };
    },
  },
  // ─ The safe: every movement of money (cash:view only)
  {
    key: "cash",
    section: "money",
    icon: "Vault",
    perm: "cash:view",
    filters: ["range", "type"],
    typeFilter: { ns: "cash.kind", values: ["DEPOSIT", "EXPENSE", "SALE", "PURCHASE", "EXCHANGE", "TRANSFER"] },
    async run(q) {
      const [list, name] = await Promise.all([
        db.cashEntry.findMany({
          where: { ...(q.type ? { kind: q.type as never } : {}), createdAt: { gte: q.start, lt: q.end } },
          orderBy: { createdAt: "asc" }, take: MAX_ROWS,
          include: { category: true, safe: { select: { name: true } }, stockDoc: { select: { id: true, number: true } } },
        }),
        userNames(),
      ]);
      const rows: Row[] = list.map((e) => {
        const a = Number(e.amount);
        return {
          at: e.createdAt, number: e.number, kind: e.kind, safe: e.safe.name, category: e.category ? (e.category.key ?? `=${e.category.name}`) : "", party: e.party ?? "",
          doc: e.stockDoc?.number ?? "", note: e.note ?? "", in: a > 0 ? a : null, out: a < 0 ? -a : null, currency: e.currency, by: name(e.createdById),
          _href: { number: `/cash/${e.id}`, ...(e.stockDoc ? { doc: `/stock/${e.stockDoc.id}` } : {}) },
        };
      });
      const tot = (col: "in" | "out", cur: string) => Math.round(sum(rows.filter((r) => r.currency === cur), (r) => num(r[col])) * 100) / 100;
      const curs = ["IQD", "USD", "EUR"].filter((c) => c === "IQD" || rows.some((r) => r.currency === c));
      return {
        columns: [
          { key: "at", label: "rep.col.when", type: "datetime" },
          { key: "number", label: "rep.col.document", type: "code" },
          { key: "kind", label: "rep.col.movement", type: "status", ns: "cash.kind", tones: { DEPOSIT: "green", EXPENSE: "red", SALE: "purple", PURCHASE: "blue", EXCHANGE: "amber", TRANSFER: "gray" } },
          { key: "safe", label: "rep.col.safe" },
          { key: "category", label: "rep.col.expenseCat", type: "status", ns: "cash.cat" },
          { key: "party", label: "rep.col.party" },
          { key: "doc", label: "rep.col.forDoc", type: "code", wide: true },
          { key: "note", label: "rep.col.note", wide: true },
          { key: "in", label: "rep.col.moneyIn", type: "int" },
          { key: "out", label: "rep.col.moneyOut", type: "int" },
          { key: "currency", label: "rep.col.currency" },
          { key: "by", label: "rep.col.by", wide: true },
        ],
        rows,
        kpis: curs.flatMap((c) => [
          { label: `rep.kpi.in${c[0]}${c.slice(1).toLowerCase()}`, value: tot("in", c), type: "int" as const, tone: "good" as const },
          { label: `rep.kpi.out${c[0]}${c.slice(1).toLowerCase()}`, value: tot("out", c), type: "int" as const, tone: "bad" as const },
        ]),
      };
    },
  },
];

/** Whether this person may open the report (screen, CSV and PDF all use this). */
export function reportAllowed(def: ReportDef, perms: Set<string>) {
  if (def.perm && !perms.has(def.perm)) return false;
  if (def.money && !canSeeMoney({ permissions: perms })) return false;
  return true;
}

export const REPORT_BY_KEY = new Map(REPORTS.map((r) => [r.key, r]));
export const SECTIONS = ["production", "orders", "warehouse", "money"] as const;

// ─────────────────────────────────────────────────────────── query parsing
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const ID = /^[a-z0-9]{10,40}$/i;
const WORD = /^[A-Z_]{2,30}$/;

/** Reads filters from the URL. Anything malformed is ignored rather than trusted. */
export function parseQuery(def: ReportDef, sp: Record<string, string | string[] | undefined>): ReportQuery {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const today = toFactoryDateInput(new Date());
  let to = isDate(get("to")) ? get("to")! : today;
  let from = isDate(get("from")) ? get("from")! : toFactoryDateInput(new Date(parseFactoryDate(to).getTime() - 29 * DAY + DAY / 2));
  if (from > to) [from, to] = [to, from];
  // Keep a single request bounded: at most ~3 years.
  if (parseFactoryDate(to).getTime() - parseFactoryDate(from).getTime() > 3 * 366 * DAY) from = toFactoryDateInput(new Date(parseFactoryDate(to).getTime() - 3 * 365 * DAY));
  const pick = (k: string, ok: (v: string) => boolean) => { const v = get(k); return v && ok(v) ? v : undefined; };
  return {
    from, to,
    start: parseFactoryDate(from),
    end: factoryDay(parseFactoryDate(to)).end,
    product: pick("product", (v) => ID.test(v)),
    item: pick("item", (v) => ID.test(v)),
    section: pick("section", (v) => v === "PRODUCT" || v === "MATERIAL") as ReportQuery["section"],
    direction: pick("direction", (v) => v === "IN" || v === "OUT") as ReportQuery["direction"],
    employee: pick("employee", (v) => ID.test(v)),
    ref: (() => { const v = get("ref")?.trim(); return v && v.length <= 80 ? v : undefined; })(),
    status: pick("status", (v) => !!def.statusFilter?.values.includes(v)),
    group: pick("group", (v) => !!def.groups?.includes(v)) ?? def.groups?.[0],
    type: pick("type", (v) => WORD.test(v) && !!def.typeFilter?.values.includes(v)),
  };
}

/** The filter values that are actually set, for URLs and export file names. */
export function queryParams(def: ReportDef, q: ReportQuery) {
  const p = new URLSearchParams();
  if (def.filters.includes("range")) { p.set("from", q.from); p.set("to", q.to); }
  for (const k of ["product", "item", "section", "direction", "employee", "ref", "status", "group", "type"] as const) {
    if (q[k] && def.filters.includes(k)) p.set(k, q[k]!);
  }
  return p;
}
