import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { dayValue, todayYmd } from "@/lib/production";
import { openOrderDemand } from "@/lib/orders";
import { getStock } from "@/lib/stock";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import DailySheet from "./daily-sheet";

export const metadata = { title: "Production entry" };

/** The production sheet: per product, batches made + pieces produced. Saved only if every item is in stock. */
export default async function DailyEntryPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await pageUser("production:create");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const today = todayYmd();
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;

  const [products, demand, stock, entered] = await Promise.all([
    db.product.findMany({
      where: { archivedAt: null, kind: "PRODUCT" }, orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, name2: true, batchYield: true, _count: { select: { components: { where: { per: "BATCH" } } } } },
    }),
    openOrderDemand(),
    getStock(),
    db.productionEntry.groupBy({ by: ["productId"], where: { day: dayValue(day) }, _sum: { quantity: true, batches: true } }),
  ]);
  if (products.length === 0) {
    return (
      <>
        <PageHeader title={t("daily.title")} />
        <EmptyState><p className="mb-3">{t("order.needProducts")}</p><LinkButton href="/products" variant="secondary">{t("nav.products")}</LinkButton></EmptyState>
      </>
    );
  }
  const rows = products.map((p) => {
    const e = entered.find((x) => x.productId === p.id);
    return {
      id: p.id, code: p.code, name: p.name, name2: p.name2, perBatch: p.batchYield, hasRecipe: p._count.components > 0,
      ordered: demand.get(p.id) ?? 0,
      stock: stock.get(p.id) ?? 0,
      today: e?._sum.quantity ?? 0,
      todayBatches: Number(e?._sum.batches ?? 0),
    };
  });

  return (
    <>
      <Link href={`/production?day=${day}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("nav.production")}
      </Link>
      <PageHeader title={t("daily.title")} subtitle={t("daily.subtitle", { date: formatDate(dayValue(day), locale) })} />
      <DailySheet rows={rows} day={day} today={today} />
    </>
  );
}
