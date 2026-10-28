"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, FileUp, PackageX, Trash2, UserMinus } from "lucide-react";
import { useFormAction } from "@/components/use-form-action";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { importOpeningStockAction, removeAllItemsAction, removeDemoUsersAction, resetDataAction } from "@/app/actions/system";

type Counts = Record<string, number>;

type Items = { products: number; materials: number; used: number };
type ImportResult = { dryRun: boolean; items: number; products: number; raw: number; packaging: number; docs: { section: string; number: string; lines: number }[] };

export default function SystemAdmin({ ops, master, demoUsers, items, opening }: { ops: Counts; master: Counts; demoUsers: number; items: Items; opening: { done: boolean; at?: string; by?: string } }) {
  const t = useTranslations("sys");
  const [scope, setScope] = useState<"operations" | "everything">("operations");
  const reset = useFormAction(resetDataAction, { resetOnSuccess: true });
  const demo = useFormAction(removeDemoUsersAction, { resetOnSuccess: true });
  const wipe = useFormAction(removeAllItemsAction, { resetOnSuccess: true });
  const imp = useFormAction(importOpeningStockAction);
  const res = imp.state?.ok ? (imp.state.data as ImportResult) : null;
  const itemsTotal = items.products + items.materials;
  const opsTotal = Object.values(ops).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="flex items-center gap-2 font-bold"><Trash2 className="size-5" /> {t("resetTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("resetIntro")}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          {Object.entries(ops).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-line py-1"><dt className="text-muted">{t(`count.${k}`)}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-sm"><b>{t("kept")}</b> {t("keptList")}</p>

        {reset.state?.ok ? (
          <div className="mt-4"><Alert tone="green">{t("resetDone")}</Alert></div>
        ) : (
          <form onSubmit={reset.onSubmit} className="mt-4 space-y-3">
            {reset.error && <Alert>{reset.error}</Alert>}
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">{t("scope")}</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="scope" value="operations" checked={scope === "operations"} onChange={() => setScope("operations")} className="mt-1" />
                <span><b>{t("scopeOps")}</b><br /><span className="text-muted">{t("scopeOpsHint")}</span></span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="scope" value="everything" checked={scope === "everything"} onChange={() => setScope("everything")} className="mt-1" />
                <span>
                  <b>{t("scopeAll")}</b><br />
                  <span className="text-muted">{t("scopeAllHint", { products: master.products })}</span>
                </span>
              </label>
            </fieldset>
            <Alert tone="amber"><AlertTriangle className="me-1 inline size-4" /> {t("warning")}</Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("typeReset")} name="confirm"><Input name="confirm" id="confirm" autoComplete="off" dir="ltr" required /></Field>
              <Field label={t("yourPassword")} name="reset-password"><Input name="password" id="reset-password" type="password" autoComplete="current-password" required /></Field>
            </div>
            <Button type="submit" variant="danger" disabled={reset.pending || (opsTotal === 0 && scope === "operations")}>
              {reset.pending ? t("working") : scope === "everything" ? t("resetAllButton") : t("resetButton")}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-bold"><FileUp className="size-5" /> {t("openTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("openIntro")}</p>
        {opening.done || (res && !res.dryRun) ? (
          <div className="mt-4 space-y-2">
            <Alert tone="green">{opening.done && !res ? t("openAlready", { at: opening.at ?? "", by: opening.by ?? "" }) : t("openDone", { n: (res?.items ?? 0).toLocaleString("en") })}</Alert>
            {res && <ul className="text-sm">{res.docs.map((d) => <li key={d.number}>{d.number} · {t(`openSec.${d.section}`)} · {t("openLines", { n: d.lines })}</li>)}</ul>}
          </div>
        ) : (
          <form onSubmit={imp.onSubmit} className="mt-4 space-y-3" encType="multipart/form-data">
            {imp.error && <Alert>{imp.error}</Alert>}
            {res?.dryRun && (
              <Alert tone="blue">
                {t("openChecked", { n: res.items.toLocaleString("en"), p: res.products, r: res.raw, k: res.packaging })}
                <ul className="mt-1">{res.docs.map((d) => <li key={d.section}>{t(`openSec.${d.section}`)}: {t("openLines", { n: d.lines })}</li>)}</ul>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("openFile")} name="open-file"><Input name="file" id="open-file" type="file" accept=".csv,text/csv" required /></Field>
              <Field label={t("yourPassword")} name="open-password"><Input name="password" id="open-password" type="password" autoComplete="current-password" required /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="mode" value="check" variant="secondary" disabled={imp.pending}>{imp.pending ? t("working") : t("openCheck")}</Button>
              <Button type="submit" name="mode" value="load" disabled={imp.pending || !res?.dryRun}>{t("openLoad")}</Button>
            </div>
            <p className="text-xs text-muted">{t("openHint")}</p>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-bold"><PackageX className="size-5" /> {t("itemsTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("itemsIntro")}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 text-sm sm:max-w-md">
          {(["products", "materials"] as const).map((k) => (
            <div key={k} className="flex justify-between gap-2 border-b border-line py-1"><dt className="text-muted">{t(`items.${k}`)}</dt><dd className="font-semibold tabular-nums">{items[k].toLocaleString("en")}</dd></div>
          ))}
        </dl>
        {wipe.state?.ok ? (
          <div className="mt-4"><Alert tone="green">{t("itemsDone", { n: (wipe.state.data as { removed: number }).removed.toLocaleString("en") })}</Alert></div>
        ) : items.used > 0 ? (
          <div className="mt-4"><Alert tone="amber">{t("itemsUsed", { n: items.used.toLocaleString("en") })}</Alert></div>
        ) : itemsTotal > 0 ? (
          <form onSubmit={wipe.onSubmit} className="mt-4 space-y-3">
            {wipe.error && <Alert>{wipe.error}</Alert>}
            <Alert tone="amber"><AlertTriangle className="me-1 inline size-4" /> {t("itemsWarning")}</Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("typeDeleteItems")} name="items-confirm"><Input name="confirm" id="items-confirm" autoComplete="off" dir="ltr" required /></Field>
              <Field label={t("yourPassword")} name="items-password"><Input name="password" id="items-password" type="password" autoComplete="current-password" required /></Field>
            </div>
            <Button type="submit" variant="danger" disabled={wipe.pending}>{wipe.pending ? t("working") : t("itemsButton", { n: itemsTotal.toLocaleString("en") })}</Button>
          </form>
        ) : null}
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 font-bold"><UserMinus className="size-5" /> {t("demoTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("demoIntro", { n: demoUsers })}</p>
        {demo.state?.ok ? (
          <div className="mt-3"><Alert tone="green">{t("demoDone")}</Alert></div>
        ) : demoUsers > 0 ? (
          <form onSubmit={demo.onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
            {demo.error && <div className="w-full"><Alert>{demo.error}</Alert></div>}
            <Field label={t("yourPassword")} name="demo-password"><Input name="password" id="demo-password" type="password" autoComplete="current-password" required /></Field>
            <Button type="submit" variant="secondary" disabled={demo.pending}>{t("demoButton")}</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
