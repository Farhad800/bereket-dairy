import "server-only";
import { db } from "./db";
import { dayValue, todayYmd } from "./production";
import { getStock } from "./stock";
import { lossOf } from "./recipe-math";

/** Every figure is a live query — no invented statistics. Quantities only (no money). */
export async function getDashboard() {
  const today = todayYmd();
  const weekAgo = new Date(dayValue(today).getTime() - 6 * 86_400_000);
  const n = (v: unknown) => Number(v ?? 0);

  const [openOrders, openPieces, producedToday, productsToday, weekEntries, stock, outWeek, materials, activity] =
    await Promise.all([
      db.order.count({ where: { status: "OPEN" } }),
      db.orderLine.aggregate({ _sum: { quantity: true }, where: { order: { status: "OPEN" } } }),
      db.productionEntry.aggregate({ _sum: { quantity: true, batches: true }, where: { day: dayValue(today) } }),
      db.productionEntry.groupBy({ by: ["productId"], where: { day: dayValue(today) } }),
      db.productionEntry.findMany({ where: { day: { gte: weekAgo } }, select: { quantity: true, batches: true, expectedPerBatch: true } }),
      db.stockMovement.aggregate({ _sum: { qty: true }, where: { product: { kind: "PRODUCT" } } }),
      db.stockMovement.aggregate({ _sum: { qty: true }, where: { type: { in: ["OUTPUT", "SELL"] }, createdAt: { gte: weekAgo }, product: { kind: "PRODUCT" } } }),
      db.product.findMany({ where: { kind: "MATERIAL", archivedAt: null, usedIn: { some: { product: { archivedAt: null } } } }, select: { id: true } }),
      db.auditLog.findMany({
        where: { NOT: { action: { startsWith: "auth." } } },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: { select: { fullName: true } } },
      }),
    ]);
  const matStock = await getStock(materials.map((m) => m.id));
  const losses = weekEntries.map((e) => lossOf(Number(e.batches), e.quantity, e.expectedPerBatch)).filter((l): l is NonNullable<typeof l> => !!l);
  const expected = losses.reduce((s, l) => s + l.expected, 0);
  const lost = losses.reduce((s, l) => s + l.lost, 0);

  return {
    cards: {
      openOrders,
      openPieces: n(openPieces._sum.quantity),
      producedToday: n(producedToday._sum.quantity),
      batchesToday: Math.round(n(producedToday._sum.batches) * 1000) / 1000,
      productsToday: productsToday.length,
      producedWeek: weekEntries.reduce((s, e) => s + e.quantity, 0),
      lossWeekPct: expected > 0 ? Math.round((lost / expected) * 10000) / 100 : 0,
      stock: n(stock._sum.qty),
      outWeek: Math.abs(n(outWeek._sum.qty)),
      outOfStock: materials.filter((m) => (matStock.get(m.id) ?? 0) <= 0).length,
    },
    activity,
  };
}
