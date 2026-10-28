import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { can, canSeeMoney, pageUser } from "@/lib/auth";
import { fifoState } from "@/lib/fifo";
import { db } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/time";
import { dayValue, todayYmd } from "@/lib/production";
import { lossOf } from "@/lib/recipe-math";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import EntryRow from "./entry-row";

export const metadata = { title: "Production" };
const shiftDay = (ymd: string, d: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

/** What was produced on a day: batches, pieces and loss per run — the factory's production record. */
export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ day?: string; product?: string }> }) {
  const me = await pageUser("production:view");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const today = todayYmd();
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;
  const product = sp.product ? await db.product.findFirst({ where: { code: { equals: sp.product, mode: "insensitive" } }, select: { id: true, code: true, name: true } }) : null;

  const entries = await db.productionEntry.findMany({
    where: product ? { productId: product.id, day: { gte: dayValue(shiftDay(today, -60)) } } : { day: dayValue(day) },
    orderBy: product ? [{ day: "desc" }, { createdAt: "desc" }] : [{ product: { code: "asc" } }, { createdAt: "asc" }],
    take: 2000,
    include: { product: { select: { code: true, name: true } } },
  });
  const users = await db.user.findMany({ where: { id: { in: [...new Set(entries.map((e) => e.createdById))] } }, select: { id: true, fullName: true } });
  const who = (id: string) => users.find((u) => u.id === id)?.fullName ?? "—";
  const n = (v: number) => formatNumber(v, locale);
  const total = entries.reduce((s, e) => s + e.quantity, 0);
  const batches = Math.round(entries.reduce((s, e) => s + Number(e.batches), 0) * 1000) / 1000;
  const losses = entries.map((e) => lossOf(Number(e.batches), e.quantity, e.expectedPerBatch)).filter((l): l is NonNullable<typeof l> => !!l);
  const expected = losses.reduce((s, l) => s + l.expected, 0);
  const lost = losses.reduce((s, l) => s + l.lost, 0);
  const canFix = can(me, "production:edit");
  const fifo = canSeeMoney(me) ? await fifoState() : null; // the real cost of each run, from the batches it used
  const runCost = (id: string) => {
    const c = fifo?.entryCost(id);
    return c && c.pieces > 0 ? { run: c.cost, perPiece: c.cost / c.pieces, complete: c.complete } : null;
  };
  const row = (e: (typeof entries)[number]) => {
    const l = lossOf(Number(e.batches), e.quantity, e.expectedPerBatch);
    return {
      cost: runCost(e.id),
      id: e.id, day: formatDate(e.day, locale), product: `${e.product.code} · ${e.product.name}`, quantity: e.quantity, batches: Number(e.batches),
      expected: l?.expected ?? null, lost: l?.lost ?? null, lossPct: l?.pct ?? null, by: who(e.createdById), notes: e.notes,
    };
  };

  return (
    <>
      <PageHeader
        title={t("nav.production")}
        subtitle={product ? `${product.code} · ${product.name} — ${t("prod.last60")}` : undefined}
        actions={can(me, "production:create") && <LinkButton href="/production/daily"><ClipboardList className="size-4" /> {t("daily.title")}</LinkButton>}
      />

      {!product && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/production?day=${shiftDay(day, -1)}`} aria-label={t("prod.prevDay")} className="grid size-11 place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2"><ChevronLeft className="size-4 rtl:rotate-180" /></Link>
          <form action="/production" className="flex items-center gap-2">
            <input type="date" name="day" defaultValue={day} max={today} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm" aria-label={t("prod.day")} dir="ltr" />
            <button className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2">{t("prod.show")}</button>
          </form>
          {day < today && <Link href={`/production?day=${shiftDay(day, 1)}`} aria-label={t("prod.nextDay")} className="grid size-11 place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2"><ChevronRight className="size-4 rtl:rotate-180" /></Link>}
          {day !== today && <Link href="/production" className="text-sm font-semibold text-brand-600">{t("prod.today")}</Link>}
        </div>
      )}
      {product && <p className="mb-4"><Link href="/production" className="text-sm font-semibold text-brand-600">← {t("prod.allProducts")}</Link></p>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">{product ? t("prod.total60") : t("prod.totalDay", { date: formatDate(dayValue(day), locale) })}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{n(total)}</p>
          <p className="text-xs text-muted">{t("prod.entriesN", { n: entries.length })}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">{t("daily.batches")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{n(batches)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">{t("prod.expected")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{expected ? n(expected) : "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">{t("prod.lost")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" data-testid="day-loss">{expected ? `${n(lost)} (${n(Math.round((lost / expected) * 10000) / 100)}%)` : "—"}</p>
        </Card>
      </div>

      {entries.length === 0 ? (
        <EmptyState>
          <p className="mb-3">{t("prod.nothingDay")}</p>
          {can(me, "production:create") && <LinkButton href={`/production/daily?day=${day}`}>{t("daily.title")}</LinkButton>}
        </EmptyState>
      ) : (
        <Card className="p-0 sm:p-0">
          <div className="hidden grid-cols-[6rem_1fr_6rem_7rem_9rem_7rem] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-muted md:grid">
            <span>{t("prod.day")}</span><span>{t("order.product")}</span><span className="text-end">{t("daily.batches")}</span><span className="text-end">{t("daily.produced")}</span><span className="text-end">{t("prod.lost")}</span><span />
          </div>
          <ul className="divide-y divide-line">
            {entries.map((e) => <EntryRow key={e.id} e={row(e)} canFix={canFix} />)}
          </ul>
        </Card>
      )}
    </>
  );
}
