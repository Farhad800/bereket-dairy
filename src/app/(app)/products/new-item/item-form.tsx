"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { createItemAction } from "@/app/actions/items";
import CostFields, { costPayload, emptyCost } from "../cost-fields";

/** An ingredient or production item, typed by hand, with its unit (kg or pieces) and cost. */
export default function ItemForm({ canCost }: { canCost: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [name2, setName2] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState<"pcs" | "kg">("kg");
  const [cost, setCost] = useState(emptyCost);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    setError(null);
    const r = await createItemAction({ name, name2: name2 || undefined, code: code || undefined, unit, cost: canCost ? costPayload(cost) : undefined });
    if (!r.ok) { setError(r.fieldErrors ? Object.values(r.fieldErrors)[0] ?? r.error : r.error); return; }
    router.push(`/products/${r.data.id}?created=1`);
  });

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">{t("item.name")} *<Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" aria-label={t("item.name")} maxLength={160} /></label>
          <label className="text-sm font-medium">{t("item.name2")}<Input value={name2} onChange={(e) => setName2(e.target.value)} className="mt-1" aria-label={t("item.name2")} maxLength={160} /></label>
          <label className="text-sm font-medium">{t("item.code")}<Input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1" dir="ltr" aria-label={t("item.code")} placeholder="MAT-…" maxLength={40} />
            <span className="text-xs font-normal text-muted">{t("item.codeHint")}</span></label>
          <label className="text-sm font-medium">{t("item.unit")}
            <Select value={unit} onChange={(e) => setUnit(e.target.value as "pcs" | "kg")} className="mt-1" aria-label={t("item.unit")}>
              <option value="kg">{t("item.unitKg")}</option><option value="pcs">{t("item.unitPcs")}</option>
            </Select>
            <span className="text-xs font-normal text-muted">{t("item.unitHint")}</span>
          </label>
        </div>
      </Card>
      {canCost && (
        <Card>
          <h2 className="mb-1 font-semibold">{t("cost.title")}</h2>
          <p className="mb-3 text-xs text-muted">{t("cost.hint")}</p>
          <CostFields value={cost} onChange={setCost} unit={unit} />
        </Card>
      )}
      {error && <Alert>{error}</Alert>}
      <Button onClick={save} disabled={pending || name.trim().length < 2 || (canCost && cost.price !== "" && cost.currency !== "IQD" && !(Number(cost.rate) > 0))}>
        <Save className="size-4" /> {pending ? t("common.saving") : t("item.save")}
      </Button>
    </div>
  );
}
