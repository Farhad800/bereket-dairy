"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save, Search } from "lucide-react";
import { useFormAction } from "@/components/use-form-action";
import { Alert, Button, cn } from "@/components/ui";
import { saveDailyEntriesAction, type SheetResult } from "@/app/actions/production";
import { lossOf } from "@/lib/recipe-math";

export type SheetRow = {
  id: string; code: string; name: string; name2: string | null; perBatch: number | null; hasRecipe: boolean;
  ordered: number; stock: number; today: number; todayBatches: number;
};
const nf = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 3 });
type Val = { b: string; q: string };

export default function DailySheet({ rows, day, today }: { rows: SheetRow[]; day: string; today: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, Val>>({});
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, pending, error, state } = useFormAction(saveDailyEntriesAction, { once: true, onSuccess: () => { setVals({}); setNotes(""); } });
  const result = state?.ok ? (state.data as SheetResult) : null;

  const go = (d: string) => router.replace(`/production/daily?day=${d}`, { scroll: false });
  const set = (id: string, k: keyof Val, v: string) => setVals((all) => ({ ...all, [id]: { ...(all[id] ?? { b: "", q: "" }), [k]: v } }));

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => !q || `${r.code} ${r.name} ${r.name2 ?? ""}`.toLowerCase().includes(q));
  }, [rows, filter]);
  const filled = Object.entries(vals).filter(([, v]) => v.b.trim() !== "" || v.q.trim() !== "");
  const pieces = filled.reduce((s, [, v]) => s + (Number(v.q) || 0), 0);
  const batches = filled.reduce((s, [, v]) => s + (Number(v.b) || 0), 0);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(formRef.current?.querySelectorAll<HTMLInputElement>("input[data-q]") ?? []);
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="pb-24">
      <input type="hidden" name="day" value={day} />
      <div className="mb-3 grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[auto_1fr] sm:items-end">
        <label className="text-xs font-semibold text-muted">
          {t("prod.day")}
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && go(e.target.value)} className="mt-1 block min-h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink" dir="ltr" />
        </label>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted start-3" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("order.filterProducts")} aria-label={t("order.filterProducts")} className="min-h-11 w-full rounded-lg border border-line bg-surface ps-9 pe-3 text-sm" />
        </label>
      </div>
      <p className="mb-3 text-sm text-muted">{t("daily.help")}</p>

      {error && <div className="mb-3"><Alert><span className="whitespace-pre-line">{error}</span></Alert></div>}
      {result && (
        <div className="mb-3"><Alert tone="green">
          {t("daily.saved", { n: result.products, pcs: nf(result.pieces), batches: nf(result.batches) })}
          {result.lost !== null && ` ${t("daily.savedLoss", { lost: nf(result.lost) })}`}
        </Alert></div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_7rem_7rem] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-muted md:grid">
          <span>{t("order.product")}</span>
          <span className="text-end">{t("daily.inOrders")}</span>
          <span className="text-end">{t("order.inStock")}</span>
          <span className="text-end">{t("daily.todayAlready")}</span>
          <span className="text-end">{t("daily.batches")}</span>
          <span className="text-end">{t("daily.produced")}</span>
        </div>
        <ul className="divide-y divide-line">
          {shown.map((r) => {
            const v = vals[r.id] ?? { b: "", q: "" };
            const loss = v.b && v.q !== "" ? lossOf(Number(v.b), Number(v.q), r.perBatch) : null;
            const active = v.b !== "" || v.q !== "";
            return (
              <li key={r.id} className={cn("grid grid-cols-[minmax(0,1fr)_6rem_6rem] items-center gap-x-3 gap-y-1 px-4 py-2 md:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_7rem_7rem]", active && "bg-surface-2")}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted">
                    <span dir="ltr">{r.name2 ? `${r.name2} · ` : ""}{r.code}</span>
                    {r.perBatch ? <> · {t("daily.perBatch", { n: nf(r.perBatch) })}</> : null}
                    <span className="md:hidden"> · {t("order.inStock")}: {nf(r.stock)}{r.today > 0 && ` · ${t("daily.todayAlready")}: ${nf(r.today)}`}</span>
                  </p>
                  {!r.hasRecipe && <p className="text-xs font-semibold">{t("daily.noRecipe")}</p>}
                  {loss && (
                    <p className={cn("text-xs", loss.lost > 0 ? "font-semibold" : "text-muted")}>
                      {t("daily.expected", { n: nf(loss.expected) })} · {loss.lost >= 0 ? t("daily.lost", { n: nf(loss.lost), pct: loss.pct }) : t("daily.over", { n: nf(-loss.lost) })}
                    </p>
                  )}
                </div>
                <span className="hidden text-end text-sm tabular-nums md:block">{r.ordered ? nf(r.ordered) : "—"}</span>
                <span className="hidden text-end text-sm tabular-nums md:block">{nf(r.stock)}</span>
                <span className={cn("hidden text-end text-sm tabular-nums md:block", r.today > 0 ? "font-semibold" : "text-muted")}>{r.today ? nf(r.today) : "—"}</span>
                <input
                  data-q name={`batches_${r.id}`} type="number" inputMode="decimal" min={0} step="0.001"
                  value={v.b} onChange={(e) => set(r.id, "b", e.target.value)} onKeyDown={onKey} disabled={!r.hasRecipe}
                  aria-label={`${r.code} ${t("daily.batches")}`} placeholder={t("daily.batches")}
                  className="min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-end text-base tabular-nums disabled:opacity-50" dir="ltr"
                />
                <input
                  data-q name={`qty_${r.id}`} type="number" inputMode="numeric" min={0} step={1}
                  value={v.q} onChange={(e) => set(r.id, "q", e.target.value)} onKeyDown={onKey} disabled={!r.hasRecipe}
                  aria-label={`${r.code} ${t("daily.produced")}`} placeholder={t("daily.pcs")}
                  className="min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-end text-base tabular-nums disabled:opacity-50" dir="ltr"
                />
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">{t("common.empty")}</p>}
      </div>

      <label className="mt-3 block text-xs font-semibold text-muted">
        {t("daily.notes")}
        <input name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink" />
      </label>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-3 py-3 backdrop-blur lg:start-64" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="text-sm">{t("daily.summary", { n: filled.length, pcs: nf(pieces), batches: nf(batches) })}</p>
          <Button type="submit" disabled={pending || filled.length === 0}><Save className="size-4" /> {pending ? t("common.saving") : t("daily.saveAll")}</Button>
        </div>
      </div>
    </form>
  );
}
