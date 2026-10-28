import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { can, canSeeMoney, pageUser } from "@/lib/auth";
import { productCosts } from "@/lib/product-costs";
import { formatDateTime } from "@/lib/time";
import { db } from "@/lib/db";
import { getStock } from "@/lib/stock";
import { cartonSplit, fmtAmount } from "@/lib/recipe-math";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import Batches from "./batches";
import ItemDetails from "./item-details";
import ItemCost from "./item-cost";
import ProductCostCard from "./product-cost";
import RecipeEditor from "./recipe-editor";

export const metadata = { title: "Product" };

/** One item: a finished product with its batch recipe, or an ingredient / production item. */
export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const me = await pageUser("products:view");
  const t = await getTranslations();
  const locale = await getLocale();
  const { id } = await params;
  const created = (await searchParams).created === "1";
  const p = await db.product.findUnique({
    where: { id },
    include: {
      components: { orderBy: { createdAt: "asc" } },
      usedIn: { include: { product: { select: { id: true, code: true, name: true } } }, take: 50 },
    },
  });
  if (!p) notFound();
  const money = canSeeMoney(me); // costs only for people who see money (Buy, Sell or Safe) — never sent to anyone else
  const stockNow = (await getStock([p.id])).get(p.id) ?? 0;
  const pcs = t("md.pcs");

  if (p.kind !== "PRODUCT") {
    const users = [...new Map(p.usedIn.map((u) => [u.product.id, u.product])).values()];
    const pack = p.materialGroup === "PACKAGING";
    return (
      <>
        <Link href={`/inventory?tab=${pack ? "packaging" : "materials"}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"><ArrowLeft className="size-4 rtl:rotate-180" /> {t(pack ? "wh.tab.packaging" : "wh.tab.materials")}</Link>
        <PageHeader title={p.name} subtitle={<span dir="ltr">{[p.name2, p.code].filter(Boolean).join(" · ")}</span>} />
        {created && <div className="mb-4"><Alert tone="green">{t("item.created", { code: p.code })}</Alert></div>}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">{t("md.kindLabel")}</dt><dd><Badge>{t(pack ? "md.kindOne.PACKAGING" : "md.kindOne.RAW")}</Badge></dd></div>
              <div><dt className="text-xs text-muted">{t("order.inStock")}</dt><dd className="font-bold" dir="ltr" data-testid="item-stock">{fmtAmount(stockNow, p.unit, pcs)}</dd></div>
              <div><dt className="text-xs text-muted">{t("item.unit")}</dt><dd>{p.unit === "kg" ? t("item.unitKg") : t("item.unitPcs")}</dd></div>
            </dl>
            <ItemDetails id={p.id} canEdit={can(me, "products:edit")} unitLocked={(await db.stockMovement.count({ where: { productId: p.id } })) > 0 || p.usedIn.length > 0}
              value={{ name: p.name, name2: p.name2 ?? "", code: p.code, unit: p.unit.toLowerCase() === "kg" ? "kg" : "pcs", group: pack ? "PACKAGING" : "RAW" }} />
            {money && (
              <div className="mt-4 border-t border-line pt-4">
                <ItemCost id={p.id} unit={p.unit.toLowerCase() === "kg" ? "kg" : "pcs"} canEdit={can(me, "products:edit")}
                  saved={p.costIqd === null ? null : { price: Number(p.costPrice), currency: p.costCurrency ?? "IQD", rate: Number(p.costRate ?? 1), iqd: Number(p.costIqd), at: p.costUpdatedAt ? formatDateTime(p.costUpdatedAt, locale) : "—" }} />
              </div>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">{t("md.usedBy")}</h2>
            {users.length === 0 ? <p className="text-sm text-muted">{t("md.notUsedYet")}</p> : (
              <ul className="divide-y divide-line text-sm">{users.map((u) => <li key={u.id} className="py-1.5"><Link href={`/products/${u.id}`} className="text-brand-600 hover:underline">{u.name}</Link> <span className="text-xs text-muted" dir="ltr">{u.code}</span></li>)}</ul>
            )}
          </Card>
        </div>
        {money && <Batches itemId={p.id} unit={p.unit} />}
      </>
    );
  }

  /** Plain numbers only go to the browser (and only for money roles). */
  async function costCard() {
    const c = (await productCosts([p!.id])).get(p!.id)!;
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const recipe = {
      piecesPerCarton: c.recipe.piecesPerCarton,
      components: c.recipe.components.map((l) => ({ qty: Number(l.qty), per: l.per, component: { id: l.component.id, code: l.component.code, name: l.component.name, unit: l.component.unit, costIqd: num(l.component.costIqd), lots: l.component.lots } })),
    };
    return <ProductCostCard recipe={recipe} initialBatches={c.batches} initialPieces={c.pieces} fromProduction={c.fromProduction} />;
  }

  const items = await db.product.findMany({ where: { kind: "MATERIAL", OR: [{ archivedAt: null }, { id: { in: p.components.map((c) => c.componentId) } }] }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, name2: true, unit: true } });
  const stock = await getStock(items.map((i) => i.id));
  const split = cartonSplit(stockNow, p.piecesPerCarton);

  return (
    <>
      <Link href="/products" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"><ArrowLeft className="size-4 rtl:rotate-180" /> {t("nav.products")}</Link>
      <PageHeader title={p.name} subtitle={<span dir="ltr">{[p.name2, p.code].filter(Boolean).join(" · ")}</span>} />
      {created && <div className="mb-4"><Alert tone="green">{t("rc.created")}</Alert></div>}
      <Card className="mb-4">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted">{t("order.inStock")}</dt><dd className="text-lg font-bold tabular-nums" data-testid="product-stock">{stockNow.toLocaleString("en")} {pcs}</dd>
            {split && <dd className="text-xs text-muted">{t("wh.cartonSplit", { c: split.cartons.toLocaleString("en"), p: split.loose.toLocaleString("en") })}</dd>}</div>
          <div><dt className="text-xs text-muted">{t("rc.batchYield")}</dt><dd className="font-semibold">{p.batchYield ? p.batchYield.toLocaleString("en") : "—"}</dd></div>
          <div><dt className="text-xs text-muted">{t("rc.piecesPerCarton")}</dt><dd className="font-semibold">{p.piecesPerCarton ? p.piecesPerCarton.toLocaleString("en") : t("rc.noCartons")}</dd></div>
          <div><dt className="text-xs text-muted">{t("prod.history")}</dt><dd><Link href={`/production?product=${encodeURIComponent(p.code)}`} className="font-semibold text-brand-600 hover:underline">{t("prod.last60")}</Link></dd></div>
        </dl>
      </Card>
      {money && await costCard()}
      {money && <div className="mb-4"><Batches itemId={p.id} unit={p.unit} /></div>}
      <div id="recipe" className="scroll-mt-4" />
      <RecipeEditor
        productId={p.id}
        canEdit={can(me, "products:edit")}
        items={items.map((i) => ({ ...i, stock: stock.get(i.id) ?? 0 }))}
        details={{ code: p.code, name: p.name, name2: p.name2 ?? "", specifications: p.specifications ?? "", batchYield: p.batchYield ? String(p.batchYield) : "", piecesPerCarton: p.piecesPerCarton ? String(p.piecesPerCarton) : "" }}
        initial={p.components.map((c) => ({ componentId: c.componentId, qty: Number(c.qty), per: c.per }))}
      />
    </>
  );
}
