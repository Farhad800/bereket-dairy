import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStock } from "@/lib/stock";
import { PageHeader } from "@/components/ui";
import RecipeEditor from "../[id]/recipe-editor";

export const metadata = { title: "New product" };

/** New finished product: name, code, pieces per batch, optional carton size, and its batch recipe. */
export default async function NewProductPage() {
  await pageUser("products:create");
  const t = await getTranslations();
  const items = await db.product.findMany({ where: { archivedAt: null, kind: "MATERIAL" }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, name2: true, unit: true } });
  const stock = await getStock(items.map((i) => i.id));
  return (
    <>
      <Link href="/products" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"><ArrowLeft className="size-4 rtl:rotate-180" /> {t("nav.products")}</Link>
      <PageHeader title={t("md.newProduct")} subtitle={t("rc.newIntro")} />
      <RecipeEditor canEdit items={items.map((i) => ({ ...i, stock: stock.get(i.id) ?? 0 }))} initial={[]}
        details={{ code: "", name: "", name2: "", specifications: "", batchYield: "", piecesPerCarton: "" }} />
    </>
  );
}
