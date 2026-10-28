"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { fmtIqd } from "@/lib/cost";
import { Pencil } from "lucide-react";
import { useFormAction } from "@/components/use-form-action";
import { Alert, Button, Input } from "@/components/ui";
import { correctEntryAction } from "@/app/actions/production";

type E = {
  id: string; day: string; product: string; quantity: number; batches: number; expected: number | null; lost: number | null; lossPct: number | null;
  by: string; notes: string | null; cost?: { run: number; perPiece: number; complete: boolean } | null;
};
const nf = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 3 });

/** One production run, with an inline "correct a typing mistake" form. */
export default function EntryRow({ e, canFix }: { e: E; canFix: boolean }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, error } = useFormAction(correctEntryAction, { onSuccess: () => setOpen(false) });
  return (
    <li className="px-4 py-2.5" data-testid="entry-row">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[6rem_1fr_6rem_7rem_9rem_7rem]">
        <span className="hidden text-xs font-semibold text-muted md:block" dir="ltr">{e.day}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{e.product}</p>
          <p className="text-xs text-muted">
            <span className="md:hidden">{nf(e.batches)} {t("daily.batches")} · </span>{e.by}{e.notes ? ` · ${e.notes}` : ""}
          </p>
          {e.cost && <p className="text-xs text-muted" data-testid="run-real-cost"><span dir="ltr">{t("lot.runCost", { piece: fmtIqd(e.cost.perPiece), run: fmtIqd(e.cost.run) })}</span>{!e.cost.complete && <span title={t("cost.partial")}> *</span>}</p>}
        </div>
        <span className="hidden text-end text-sm tabular-nums md:block">{nf(e.batches)}</span>
        <span className="text-end text-base font-bold tabular-nums">{e.quantity.toLocaleString("en")}</span>
        <span className="col-span-2 text-xs md:col-span-1 md:text-end md:text-sm">
          {e.lost === null ? <span className="text-muted">—</span>
            : e.lost >= 0 ? <span className={e.lost > 0 ? "font-semibold" : "text-muted"} data-testid="entry-loss">{t("prod.lostOf", { lost: nf(e.lost), expected: nf(e.expected!), pct: e.lossPct! })}</span>
            : <span data-testid="entry-loss">{t("daily.over", { n: nf(-e.lost) })}</span>}
        </span>
        <span className="text-end">
          {canFix && !open && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Pencil className="size-3.5" /> {t("prod.correct")}</Button>
          )}
        </span>
      </div>
      {open && (
        <form onSubmit={onSubmit} className="mt-2 grid gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-[7rem_8rem_1fr_auto_auto] sm:items-end">
          <input type="hidden" name="entryId" value={e.id} />
          {error && <div className="sm:col-span-5"><Alert><span className="whitespace-pre-line">{error}</span></Alert></div>}
          <label className="text-xs font-semibold text-muted">{t("daily.batches")}
            <Input name="batches" type="number" min={0} step="0.001" defaultValue={e.batches} required dir="ltr" className="mt-1" />
          </label>
          <label className="text-xs font-semibold text-muted">{t("daily.produced")}
            <Input name="quantity" type="number" min={0} step={1} defaultValue={e.quantity} required dir="ltr" className="mt-1" />
          </label>
          <label className="text-xs font-semibold text-muted">{t("prod.reason")}
            <Input name="reason" required minLength={3} placeholder={t("prod.correctReasonHint")} className="mt-1" />
          </label>
          <Button type="submit" size="sm" disabled={pending}>{t("common.save")}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <p className="text-xs text-muted sm:col-span-5">{t("prod.correctHelp")}</p>
        </form>
      )}
    </li>
  );
}
