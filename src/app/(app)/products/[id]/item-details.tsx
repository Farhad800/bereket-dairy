"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Save, X } from "lucide-react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { updateItemAction } from "@/app/actions/items";

export type ItemDetailsValue = { name: string; name2: string; code: string; unit: "pcs" | "kg" };

/** Edit an ingredient / production item in the same boxes as when it was added. */
export default function ItemDetails({ id, value, canEdit, unitLocked }: { id: string; value: ItemDetailsValue; canEdit: boolean; unitLocked: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!canEdit) return null;
  const save = () => start(async () => {
    setError(null);
    const r = await updateItemAction({ id, name: v.name, name2: v.name2 || undefined, code: v.code || undefined, unit: v.unit });
    if (!r.ok) { setError(r.fieldErrors ? Object.values(r.fieldErrors)[0] ?? r.error : r.error); return; }
    setEdit(false); router.refresh();
  });
  if (!edit) return <Button variant="secondary" className="mt-4" onClick={() => setEdit(true)} id="edit"><Pencil className="size-4" /> {t("item.edit")}</Button>;
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4" id="edit">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">{t("item.name")} *<Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="mt-1" aria-label={t("item.name")} maxLength={160} /></label>
        <label className="text-sm font-medium">{t("item.name2")}<Input value={v.name2} onChange={(e) => setV({ ...v, name2: e.target.value })} className="mt-1" aria-label={t("item.name2")} maxLength={160} /></label>
        <label className="text-sm font-medium">{t("item.code")}<Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} className="mt-1" dir="ltr" aria-label={t("item.code")} maxLength={40} /></label>
        <label className="text-sm font-medium">{t("item.unit")}
          <Select value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value as "pcs" | "kg" })} className="mt-1" aria-label={t("item.unit")} disabled={unitLocked}>
            <option value="kg">{t("item.unitKg")}</option><option value="pcs">{t("item.unitPcs")}</option>
          </Select>
          {unitLocked && <span className="text-xs font-normal text-muted">{t("item.unitLocked")}</span>}
        </label>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending || v.name.trim().length < 2}><Save className="size-4" /> {pending ? t("common.saving") : t("common.save")}</Button>
        <Button variant="ghost" onClick={() => { setEdit(false); setV(value); setError(null); }}><X className="size-4" /> {t("common.cancel")}</Button>
      </div>
    </div>
  );
}
