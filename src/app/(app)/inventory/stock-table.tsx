"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { cn } from "@/components/ui";
import { fmtIqd } from "@/lib/cost";
import { cartonSplit, fmtAmount } from "@/lib/recipe-math";

type Row = { id: string; code: string; name: string; name2: string | null; unit: string; ppc?: number | null; stock: number; cost?: number | null; costPartial?: boolean };
/** Item · cost per unit (wide screens) · in stock · value in IQD (stock × cost). */
const COLS = "grid-cols-[1fr_6rem_6.5rem] sm:grid-cols-[1fr_8rem_9rem_9rem]";

/**
 * Read-only stock list: stock only changes through stock documents (in / out / buy / sell) and production.
 * Prices and values are only in the rows for people who see money — the server never sends them otherwise.
 */
export default function StockTable({ rows, products = false, money = false }: { rows: Row[]; products?: boolean; money?: boolean }) {
  const t = useTranslations();
  const [filter, setFilter] = useState("");
  const [onlyStock, setOnlyStock] = useState(false);
  const pcs = t("md.pcs");
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => (!onlyStock || r.stock !== 0) && (!q || `${r.code} ${r.name} ${r.name2 ?? ""}`.toLowerCase().includes(q)));
  }, [rows, filter, onlyStock]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted start-3" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("wh.filterItems")} aria-label={t("wh.filterItems")} className="min-h-11 w-full rounded-lg border border-line bg-surface ps-9 pe-3 text-sm" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} className="size-5 accent-brand-600" /> {t("wh.onlyInStock")}
        </label>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className={cn("grid gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-muted", money ? COLS : "grid-cols-[1fr_10rem]")}>
          <span>{t("wh.item")}</span>{money && <span className="hidden text-end sm:block">{t(products ? "cost.colPiece" : "cost.colUnit")}</span>}<span className="text-end">{t("order.inStock")}</span>
          {money && <span className="text-end">{t("cost.colValue")}</span>}
        </div>
        <ul className="divide-y divide-line">
          {shown.map((r) => {
            const split = products ? cartonSplit(r.stock, r.ppc) : null;
            return (
              <li key={r.id} className={cn("grid items-center gap-3 px-4 py-2", money ? COLS : "grid-cols-[1fr_10rem]")} data-testid={`row-${r.code}`}>
                <div className="min-w-0">
                  <Link href={`/products/${r.id}`} className="block truncate text-sm font-medium hover:underline">{r.name}</Link>
                  <p className="truncate text-xs text-muted" dir="ltr">{r.name2 ? `${r.name2} · ` : ""}{r.code}</p>
                  {money && r.cost !== null && r.cost !== undefined && <p className="text-xs text-muted sm:hidden" dir="ltr">{fmtIqd(r.cost)} IQD / {r.unit.toLowerCase() === "kg" ? "kg" : pcs}{r.costPartial && " *"}</p>}
                </div>
                {money && (
                  <span className="hidden text-end text-sm tabular-nums sm:block" dir="ltr" data-testid={`cost-${r.code}`}>
                    {r.cost === null || r.cost === undefined ? <span className="text-muted">—</span> : <>{fmtIqd(r.cost)}{r.costPartial && <span title={t("cost.partial")}> *</span>}</>}
                    {r.cost !== null && r.cost !== undefined && <span className="block text-xs text-muted">IQD / {r.unit.toLowerCase() === "kg" ? "kg" : pcs}</span>}
                  </span>
                )}
                <span className={cn("text-end tabular-nums", r.stock === 0 && "text-muted")} dir="ltr" data-testid={`stock-${r.code}`}>
                  <span className={cn("text-base font-bold", r.stock === 0 && "font-normal")}>{fmtAmount(r.stock, r.unit, pcs)}</span>
                  {split && r.stock > 0 && <span className="block text-xs text-muted">{t("wh.cartonSplit", { c: split.cartons.toLocaleString("en"), p: split.loose.toLocaleString("en") })}</span>}
                </span>
                {money && (
                  <span className="text-end text-sm font-semibold tabular-nums" dir="ltr" data-testid={`value-${r.code}`}>
                    {r.cost === null || r.cost === undefined || r.stock <= 0 ? <span className="font-normal text-muted">—</span> : fmtIqd(Math.round(r.cost * r.stock * 100) / 100)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">{t("wh.noStock")}</p>}
      </div>
    </div>
  );
}
