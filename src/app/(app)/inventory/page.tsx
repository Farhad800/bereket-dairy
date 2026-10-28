import Link from "next/link";
import type { StockMoveType } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { can, canSeeMoney, pageUser } from "@/lib/auth";
import { fifoState } from "@/lib/fifo";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/time";
import { getStock } from "@/lib/stock";
import { fmtAmount } from "@/lib/recipe-math";
import { MOVE_TONE } from "@/lib/tones";
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, PackagePlus } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/ui";
import ListToolbar from "@/components/list-toolbar";
import StockTable from "./stock-table";
import StockValue, { type Section, type SectionValue } from "./stock-value";

export const metadata = { title: "Warehouse" };
/** The warehouse has exactly two sections, plus the list of recent movements. */
const TABS = ["products", "materials", "movements"] as const;
const TYPES: StockMoveType[] = ["PRODUCTION", "USE", "INPUT", "OUTPUT", "BUY", "SELL"];
/** Average cost per unit of what is in stock (Σ batch left × its cost ÷ stock); with no stock, the latest cost. */
function unitCost(f: Awaited<ReturnType<typeof fifoState>>, id: string) {
  const v = f.value(id);
  if (v.qty > 0.0000005 && v.noCost < v.qty) return { unit: v.value / (v.qty - v.noCost), partial: v.noCost > 0 || f.partial(id) };
  return { unit: f.lastUnit(id), partial: f.partial(id) };
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string }> }) {
  const me = await pageUser("warehouse:view");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "products";
  const n = (v: number) => formatNumber(v, locale);
  const q = sp.q?.trim();
  const money = canSeeMoney(me); // costs and values only for people who see money — never sent to anyone else
  const pcs = t("md.pcs");

  return (
    <>
      <PageHeader title={t("nav.inventory")} subtitle={t("wh.readOnlyNote")} actions={<>
        {can(me, "stock:input") && <LinkButton href="/stock/new?type=INPUT"><ArrowDownToLine className="size-4" /> {t("wh.recordIn")}</LinkButton>}
        {can(me, "stock:output") && <LinkButton href="/stock/new?type=OUTPUT" variant="secondary"><ArrowUpFromLine className="size-4" /> {t("wh.recordOut")}</LinkButton>}
        {can(me, "reports:view") && <LinkButton href="/reports/warehouse-daily" variant="secondary"><BarChart3 className="size-4" /> {t("wh.dailyReport")}</LinkButton>}
        {can(me, "products:create") && tab === "materials" && <LinkButton href="/products/new-item" variant="secondary"><PackagePlus className="size-4" /> {t("item.newButton")}</LinkButton>}
      </>} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((k) => (
          <Link key={k} href={`/inventory?tab=${k}`} role="tab" aria-selected={tab === k}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap", tab === k ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t(`wh.tab.${k}`)}
          </Link>
        ))}
      </div>
      {money && tab !== "movements" && <div className="mb-4">{await valuePanel()}</div>}
      {tab === "movements" ? <MovementsTab /> : <SectionTab kind={tab === "materials" ? "MATERIAL" : "PRODUCT"} />}
    </>
  );

  /** Value of all stock in IQD per section (each batch still in stock × its own cost). Money roles only. */
  async function valuePanel() {
    const [items, fifo] = await Promise.all([db.product.findMany({ where: { archivedAt: null }, select: { id: true, kind: true } }), fifoState()]);
    const values = { PRODUCT: { value: 0, items: 0, noCost: 0 }, MATERIAL: { value: 0, items: 0, noCost: 0 } } as Record<Exclude<Section, "ALL">, SectionValue>;
    for (const it of items) {
      const b = fifo.value(it.id);
      if (!(b.qty > 0)) continue;
      const v = values[it.kind as Exclude<Section, "ALL">];
      v.items++;
      if (b.noCost > 0) v.noCost++;
      v.value += Math.max(0, b.value);
    }
    return <StockValue key={tab} values={values} initial={tab === "materials" ? "MATERIAL" : "PRODUCT"} />;
  }

  async function SectionTab({ kind }: { kind: "PRODUCT" | "MATERIAL" }) {
    const items = await db.product.findMany({ where: { archivedAt: null, kind }, orderBy: kind === "PRODUCT" ? { code: "asc" } : { name: "asc" }, select: { id: true, code: true, name: true, name2: true, unit: true, piecesPerCarton: true } });
    const [stock, fifo] = await Promise.all([getStock(items.map((i) => i.id)), money ? fifoState() : null]);
    const rows = items.map((i) => {
      const c = fifo ? unitCost(fifo, i.id) : null;
      // Prices are only put in the page data for money roles.
      return { id: i.id, code: i.code, name: i.name, name2: i.name2, unit: i.unit, ppc: i.piecesPerCarton, stock: stock.get(i.id) ?? 0, ...(money ? { cost: c?.unit ?? null, costPartial: !!c?.partial } : {}) };
    });
    const kg = rows.filter((r) => r.unit.toLowerCase() === "kg");
    const out = rows.filter((r) => r.stock <= 0).length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card><p className="text-xs text-muted">{t(kind === "PRODUCT" ? "wh.productsN" : "wh.itemsN")}</p><p className="mt-1 text-2xl font-bold tabular-nums">{n(rows.length)}</p></Card>
          <Card><p className="text-xs text-muted">{t("wh.withStock")}</p><p className="mt-1 text-2xl font-bold tabular-nums">{n(rows.length - out)}</p></Card>
          <Card><p className="text-xs text-muted">{t("wh.outOfStock")}</p><p className="mt-1 text-2xl font-bold tabular-nums" data-testid="out-of-stock">{n(out)}</p></Card>
          {kind === "PRODUCT"
            ? <Card><p className="text-xs text-muted">{t("wh.totalPieces")}</p><p className="mt-1 text-2xl font-bold tabular-nums">{n(rows.reduce((s, r) => s + r.stock, 0))}</p></Card>
            : kg.length > 0 && <Card><p className="text-xs text-muted">{t("wh.totalKg")}</p><p className="mt-1 text-2xl font-bold tabular-nums" dir="ltr">{fmtAmount(kg.reduce((s, r) => s + r.stock, 0), "kg")}</p></Card>}
        </div>
        {money && <p className="text-xs text-muted">{t("cost.tableHint")}</p>}
        {rows.length === 0 ? <EmptyState>{t(kind === "PRODUCT" ? "wh.noProducts" : "wh.noMaterials")}</EmptyState> : <StockTable key={kind} rows={rows} products={kind === "PRODUCT"} money={money} />}
      </div>
    );
  }

  async function MovementsTab() {
    const type = TYPES.includes(sp.type as StockMoveType) ? (sp.type as StockMoveType) : undefined;
    const moves = await db.stockMovement.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(q ? { product: { OR: [{ code: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 300,
      include: { product: { select: { code: true, name: true, unit: true } }, doc: { select: { number: true, reference: true } } },
    });
    const users = await db.user.findMany({ where: { id: { in: [...new Set(moves.map((m) => m.createdById))] } }, select: { id: true, fullName: true } });
    return (
      <>
        <ListToolbar placeholder={t("order.filterProducts")} filters={[{ name: "type", label: t("wh.allTypes"), options: TYPES.map((x) => ({ value: x, label: t(`wh.mv.${x}`) })) }]} />
        {moves.length === 0 ? <EmptyState>{t("common.empty")}</EmptyState> : (
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-line">
              {moves.map((m) => (
                <li key={m.id} className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={MOVE_TONE[m.type]}>{t(`wh.mv.${m.type}`)}</Badge>
                      <span className="truncate font-medium">{m.product.name}</span>
                      <span className="text-xs text-muted" dir="ltr">{m.product.code}</span>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {formatDateTime(m.createdAt, locale)} · {users.find((u) => u.id === m.createdById)?.fullName ?? "—"}
                      {m.doc?.reference && <> · <span dir="ltr">{m.doc.reference}</span></>}
                      {m.docId && <> · <Link href={`/stock/${m.docId}`} className="text-brand-600">{m.doc?.number ?? t("sd.viewDoc")}</Link></>}
                      {m.type === "USE" || m.type === "PRODUCTION" ? <> · {m.reason}</> : null}
                    </p>
                  </div>
                  <span className="self-center text-end font-bold tabular-nums" dir="ltr">{Number(m.qty) > 0 ? "+" : "−"}{fmtAmount(Math.abs(Number(m.qty)), m.product.unit, pcs)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {moves.length === 300 && <div className="mt-2"><Alert tone="blue">{t("wh.moreInReport")}</Alert></div>}
      </>
    );
  }
}
