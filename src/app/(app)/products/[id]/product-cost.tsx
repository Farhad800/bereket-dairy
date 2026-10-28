"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Input } from "@/components/ui";
import { fmtIqd, productCost, type CostRecipe } from "@/lib/cost";
import { fmtAmount } from "@/lib/recipe-math";

/**
 * What a production run of B batches giving N pieces costs, and what one piece of it costs, using the
 * quantities production takes from stock (ingredients × batches, packaging × pieces, whole cartons).
 * Shown only to money roles.
 */
export default function ProductCostCard({ recipe, initialBatches, initialPieces, fromProduction }: { recipe: CostRecipe; initialBatches: number; initialPieces: number; fromProduction: boolean }) {
  const t = useTranslations();
  const [batches, setBatches] = useState(String(initialBatches));
  const [pieces, setPieces] = useState(String(initialPieces));
  const n = Math.max(0, Math.floor(Number(pieces) || 0));
  const b = Math.max(0, Number(batches) || 0);
  const cost = productCost(recipe, b, n);
  const same = Number(pieces) === initialPieces && Number(batches) === initialBatches;
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("cost.productTitle")}</h2>
          <p className="max-w-xl text-xs text-muted">{t("cost.productHint")}</p>
        </div>
        <div className="flex gap-2">
          <label className="text-sm font-medium">{t("daily.batches")}
            <Input type="number" inputMode="decimal" min={0} step="0.001" value={batches} onChange={(e) => setBatches(e.target.value)} dir="ltr" className="mt-1 w-28 text-end" aria-label={t("daily.batches")} data-testid="cost-batches" />
          </label>
          <label className="text-sm font-medium">{t("cost.piecesMade")}
            <Input type="number" inputMode="numeric" min={1} step={1} value={pieces} onChange={(e) => setPieces(e.target.value)} dir="ltr" className="mt-1 w-32 text-end" aria-label={t("cost.piecesMade")} data-testid="cost-pieces" />
          </label>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">{t(fromProduction && same ? "cost.lastProduction" : "cost.typeQty")}</p>
      {cost.missing.length > 0 && <p className="mt-2 text-sm font-semibold" data-testid="cost-missing">{t("cost.missing", { items: cost.missing.map((m) => m.name).join(", ") })}</p>}
      {cost.noRecipe ? <p className="mt-2 text-sm text-muted">{t("cost.noRecipe")}</p> : n > 0 && (
        <>
          <div className="table-wrap mt-3">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted"><tr><th className="py-1 text-start">{t("wh.item")}</th><th className="py-1 text-end">{t("cost.usedRun")}</th><th className="py-1 text-end">{t("cost.unitCost")}</th><th className="py-1 text-end">{t("cost.cost")}</th></tr></thead>
              <tbody className="divide-y divide-line">
                {cost.parts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1.5"><Link href={`/products/${p.id}`} className="text-brand-600 hover:underline">{p.name}</Link> <span className="text-xs text-muted">· {t(`cost.why.${p.why}`)}</span></td>
                    <td className="py-1.5 text-end tabular-nums" dir="ltr">{fmtAmount(p.qty, p.unit, t("md.pcs"))}</td>
                    <td className="py-1.5 text-end tabular-nums" dir="ltr">{p.unitCost === null ? "—" : `${fmtIqd(p.unitCost)} / ${p.unit.toLowerCase() === "kg" ? "kg" : t("md.pcs")}`}</td>
                    <td className="py-1.5 text-end font-semibold tabular-nums" dir="ltr">{p.cost === null ? "?" : fmtIqd(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold"><td className="py-1.5" colSpan={3}>{t("cost.runTotal2", { b: b.toLocaleString("en"), n: n.toLocaleString("en") })}</td><td className="py-1.5 text-end tabular-nums" dir="ltr" data-testid="run-cost">{fmtIqd(cost.total)}</td></tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3">
            <span className="font-semibold">{t("cost.onePieceCost")}</span>
            <span className="text-2xl font-bold tabular-nums" dir="ltr" data-testid="product-cost">{fmtIqd(cost.perPiece)} IQD</span>
          </p>
        </>
      )}
    </Card>
  );
}
