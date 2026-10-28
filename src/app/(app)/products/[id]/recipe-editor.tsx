"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Box, FlaskConical, Package, Plus, Save, Trash2 } from "lucide-react";
import Combobox from "@/components/combobox";
import { Alert, Button, Card, Input, Select, cn } from "@/components/ui";
import { createProductAction, saveProductPageAction } from "@/app/actions/masterdata";
import { cartonsFor, fmtAmount as showQty, isKg, lossOf, needsFor, r6 } from "@/lib/recipe-math";

export type Item = { id: string; code: string; name: string; name2: string | null; unit: string; stock: number };
type Per = "BATCH" | "PIECE" | "CARTON";
type U = "kg" | "g" | "pcs";
type Line = { key: number; componentId: string; qty: string; u: U; per: Per };

export type Details = { code: string; name: string; name2: string; specifications: string; batchYield: string; piecesPerCarton: string };

/**
 * A finished product's details and recipe: ingredients per BATCH, packaging per PIECE and per CARTON,
 * with a live preview of what B batches giving N pieces take from stock. Same boxes when adding and editing.
 */
export default function RecipeEditor({ productId, canEdit, items, initial, details }: {
  productId?: string; canEdit: boolean; items: Item[];
  initial: { componentId: string; qty: number; per: Per }[];
  details: Details;
}) {
  const t = useTranslations();
  const creating = !productId;
  const [d, setD] = useState(details);
  const [cartons, setCartons] = useState(!!details.piecesPerCarton);
  const all = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const seq = useRef(initial.length);
  const [lines, setLines] = useState<Line[]>(() => initial.map((l, i) => {
    const c = items.find((x) => x.id === l.componentId);
    const kg = c ? isKg(c.unit) : false;
    const g = kg && l.qty < 1;
    return { key: i, componentId: l.componentId, qty: String(g ? r6(l.qty * 1000) : l.qty), u: kg ? (g ? "g" : "kg") : "pcs", per: l.per };
  }));
  const [pb, setPb] = useState("1");
  const [pp, setPp] = useState(details.batchYield || "1000");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const add = (per: Per) => setLines((ls) => [...ls, { key: ++seq.current, componentId: "", qty: "", u: "kg", per }]);
  const remove = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));
  const baseQty = (l: Line) => (l.u === "g" ? r6(Number(l.qty) / 1000) : Number(l.qty));
  const ppc = cartons && Number(d.piecesPerCarton) > 0 ? Math.floor(Number(d.piecesPerCarton)) : null;

  const preview = useMemo(() => {
    const b = Number(pb), n = Math.floor(Number(pp));
    if (!(b > 0) && !(n > 0)) return [];
    return needsFor({
      piecesPerCarton: ppc,
      components: lines.filter((l) => l.componentId && Number(l.qty) > 0 && all.get(l.componentId) && (l.per !== "CARTON" || ppc)).map((l) => {
        const c = all.get(l.componentId)!;
        return { qty: baseQty(l), per: l.per, component: { id: c.id, code: c.code, name: c.name, unit: c.unit } };
      }),
    }, b > 0 ? b : 0, n > 0 ? n : 0);
  }, [pb, pp, lines, all, ppc]);
  const loss = lossOf(Number(pb), Math.floor(Number(pp)), Number(d.batchYield) || null);

  const save = () => start(async () => {
    setMsg(null);
    const payloadLines = lines.filter((l) => (l.componentId || l.qty) && (l.per !== "CARTON" || ppc)).map((l) => ({ componentId: l.componentId, qty: baseQty(l), per: l.per }));
    const det = {
      code: d.code || undefined, name: d.name, name2: d.name2 || undefined, specifications: d.specifications || undefined,
      batchYield: d.batchYield || undefined, piecesPerCarton: cartons && d.piecesPerCarton ? d.piecesPerCarton : undefined,
    };
    const r = creating
      ? await createProductAction({ ...det, lines: payloadLines })
      : await saveProductPageAction({ productId, lines: payloadLines, ...(canEdit ? { details: det } : {}) });
    if (r && !r.ok) setMsg({ ok: false, text: r.fieldErrors ? Object.values(r.fieldErrors)[0] ?? r.error : r.error });
    else setMsg({ ok: true, text: t("rc.saved") });
  });

  const opt = items.map((i) => ({ value: i.id, label: i.name, hint: [i.code, i.name2, i.unit].filter(Boolean).join(" · ") }));
  const perText = (per: Per) => t(per === "BATCH" ? "rc.perBatch" : per === "PIECE" ? "rc.perPiece" : "rc.perCarton");
  const rows = (per: Per) => lines.filter((l) => l.per === per).map((l) => {
    const c = all.get(l.componentId);
    const kg = c ? isKg(c.unit) : true;
    return (
      <li key={l.key} className="grid gap-2 py-2 sm:grid-cols-[1fr_8rem_5.5rem_auto] sm:items-start" data-testid={`line-${per}`}>
        <div>
          {canEdit ? <Combobox name={`c_${l.key}`} options={opt} defaultValue={l.componentId} onChange={(v) => {
            const it = all.get(v);
            set(l.key, { componentId: v, u: it && isKg(it.unit) ? (l.u === "pcs" ? "kg" : l.u) : "pcs" });
          }} placeholder={t("rc.chooseItem")} /> : <p className="text-sm">{c?.name}</p>}
          {c && <p className="mt-0.5 text-xs text-muted" dir="ltr">{c.code} · {t("order.inStock")}: {showQty(c.stock, c.unit)}</p>}
        </div>
        <Input type="number" step="any" min={0} value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} disabled={!canEdit}
          aria-label={`${c?.code ?? ""} ${perText(per)}`} dir="ltr" className="text-end" />
        {kg ? (
          <Select value={l.u} onChange={(e) => set(l.key, { u: e.target.value as U })} disabled={!canEdit} aria-label={t("item.unit")}>
            <option value="kg">kg</option><option value="g">g</option>
          </Select>
        ) : <span className="flex min-h-11 items-center text-sm text-muted">{t("md.pcs")}</span>}
        {canEdit ? <Button type="button" size="sm" variant="ghost" onClick={() => remove(l.key)} aria-label={t("order.removeLine")}><Trash2 className="size-4" /></Button> : <span />}
        <span className="text-xs text-muted sm:col-span-4">{perText(per)}</span>
      </li>
    );
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card id="edit">
          <h2 className="mb-2 font-semibold">{t("rc.details")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">{t("md.productName")} *<Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} disabled={!canEdit} className="mt-1" aria-label={t("md.productName")} maxLength={160} /></label>
            <label className="text-sm font-medium">{t("md.name2")}<Input value={d.name2} onChange={(e) => setD({ ...d, name2: e.target.value })} disabled={!canEdit} className="mt-1" aria-label={t("md.name2")} maxLength={160} /></label>
            <label className="text-sm font-medium">{t("md.productCode")}<Input value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} disabled={!canEdit} className="mt-1" dir="ltr" aria-label={t("md.productCode")} placeholder={creating ? t("item.codeAuto") : undefined} /></label>
            <label className="text-sm font-medium">{t("rc.batchYield")}
              <Input type="number" min={1} step={1} value={d.batchYield} onChange={(e) => setD({ ...d, batchYield: e.target.value })} disabled={!canEdit} className="mt-1 text-end" dir="ltr" aria-label={t("rc.batchYield")} />
              <span className="text-xs font-normal text-muted">{t("rc.batchYieldHint")}</span>
            </label>
            <div className="text-sm font-medium sm:col-span-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={cartons} onChange={(e) => setCartons(e.target.checked)} disabled={!canEdit} className="size-5 accent-brand-600" aria-label={t("rc.packedInCartons")} /> {t("rc.packedInCartons")}</label>
              {cartons && (
                <label className="mt-2 block max-w-xs">{t("rc.piecesPerCarton")}
                  <Input type="number" min={1} step={1} value={d.piecesPerCarton} onChange={(e) => setD({ ...d, piecesPerCarton: e.target.value })} disabled={!canEdit} className="mt-1 text-end" dir="ltr" aria-label={t("rc.piecesPerCarton")} />
                </label>
              )}
              <p className="mt-1 text-xs font-normal text-muted">{t("rc.cartonsOptional")}</p>
            </div>
            <label className="text-sm font-medium sm:col-span-2">{t("md.specifications")}<Input value={d.specifications} onChange={(e) => setD({ ...d, specifications: e.target.value })} disabled={!canEdit} className="mt-1" aria-label={t("md.specifications")} maxLength={2000} /></label>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><FlaskConical className="size-4" /> {t("rc.batchTitle")}</h2>
          <p className="text-xs text-muted">{t("rc.batchHint")}</p>
          <ul className="divide-y divide-line">{rows("BATCH")}</ul>
          {canEdit && <Button type="button" size="sm" variant="secondary" onClick={() => add("BATCH")} className="mt-2"><Plus className="size-4" /> {t("rc.addIngredient")}</Button>}
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Package className="size-4" /> {t("rc.pieceTitle")}</h2>
          <p className="text-xs text-muted">{t("rc.pieceHint")}</p>
          <ul className="divide-y divide-line">{rows("PIECE")}</ul>
          {canEdit && <Button type="button" size="sm" variant="secondary" onClick={() => add("PIECE")} className="mt-2"><Plus className="size-4" /> {t("rc.addPieceItem")}</Button>}
        </Card>

        {cartons && (
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-semibold"><Box className="size-4" /> {t("rc.cartonTitle")}</h2>
            <p className="text-xs text-muted">{t("rc.cartonHint")}</p>
            <ul className="divide-y divide-line">{rows("CARTON")}</ul>
            {canEdit && <Button type="button" size="sm" variant="secondary" onClick={() => add("CARTON")} className="mt-2"><Plus className="size-4" /> {t("rc.addCartonItem")}</Button>}
          </Card>
        )}

        {msg && <Alert tone={msg.ok ? "green" : "red"}><span className="whitespace-pre-line">{msg.text}</span></Alert>}
        {canEdit && <Button onClick={save} disabled={pending || d.name.trim().length < 2}><Save className="size-4" /> {pending ? t("common.saving") : creating ? t("rc.create") : t("rc.save")}</Button>}
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <h2 className="font-semibold">{t("rc.preview")}</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">{t("daily.batches")}
            <Input type="number" min={0} step="0.001" value={pb} onChange={(e) => setPb(e.target.value)} className="mt-1 text-end" dir="ltr" aria-label={t("rc.previewBatches")} />
          </label>
          <label className="text-xs font-semibold text-muted">{t("daily.produced")}
            <Input type="number" min={0} step={1} value={pp} onChange={(e) => setPp(e.target.value)} className="mt-1 text-end" dir="ltr" aria-label={t("rc.previewPieces")} />
          </label>
        </div>
        {loss && <p className="mt-2 text-xs text-muted">{t("daily.expected", { n: loss.expected.toLocaleString("en") })} · {loss.lost >= 0 ? t("daily.lost", { n: loss.lost.toLocaleString("en"), pct: loss.pct }) : t("daily.over", { n: (-loss.lost).toLocaleString("en") })}</p>}
        {ppc && Number(pp) > 0 && <p className="mt-1 text-xs text-muted">{t("rc.cartonsUsed", { n: cartonsFor(Math.floor(Number(pp)), ppc) })}</p>}
        {preview.length === 0 ? <p className="mt-3 text-sm text-muted">{t("rc.nothingUsed")}</p> : (
          <ul className="mt-3 divide-y divide-line text-sm" data-testid="recipe-preview">
            {preview.map((n) => {
              const c = all.get(n.componentId);
              const short = c && c.stock < n.qty;
              return (
                <li key={n.componentId} className="flex items-start justify-between gap-3 py-1.5">
                  <span className="min-w-0"><span className="block truncate">{n.name}</span><span className="text-xs text-muted" dir="ltr">{n.code}</span></span>
                  <span className={cn("text-end font-semibold tabular-nums", short && "underline decoration-2")} dir="ltr">
                    {showQty(n.qty, n.unit)}
                    {short && <span className="block text-xs font-normal">{t("rc.inStockOnly", { n: showQty(c!.stock, c!.unit) })}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">{t("rc.previewNote")}</p>
      </Card>
    </div>
  );
}
