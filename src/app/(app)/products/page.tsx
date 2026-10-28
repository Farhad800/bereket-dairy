import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { Plus, PackagePlus } from "lucide-react";
import { pageUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import ListToolbar from "@/components/list-toolbar";
import MasterList from "@/components/master-list";

export const metadata = { title: "Products" };
const LIMIT = 300;

/** Finished products and their recipes. (Ingredients and production items are on the Warehouse page.) */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const me = await pageUser("products:view");
  const t = await getTranslations();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.ProductWhereInput = {
    kind: "PRODUCT",
    archivedAt: sp.archived === "1" ? { not: null } : null,
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { name2: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };
  const [products, total] = await Promise.all([
    db.product.findMany({ where, orderBy: { code: "asc" }, take: LIMIT, include: { _count: { select: { components: true } } } }),
    db.product.count({ where }),
  ]);
  const canCreate = can(me, "products:create");

  return (
    <>
      <PageHeader
        title={t("nav.products")}
        subtitle={t("md.productsN", { n: total })}
        actions={canCreate ? (
          <>
            <LinkButton href="/products/new"><Plus className="size-4" /> {t("md.newProduct")}</LinkButton>
            <LinkButton href="/products/new-item" variant="secondary"><PackagePlus className="size-4" /> {t("item.newButton")}</LinkButton>
          </>
        ) : undefined}
      />
      <ListToolbar
        placeholder={t("md.searchProducts")}
        filters={[{ name: "archived", label: t("common.active"), options: [{ value: "1", label: t("common.archived") }] }]}
      />
      {total > LIMIT && <div className="mb-3"><Alert tone="blue">{t("md.showingFirst", { n: LIMIT, total })}</Alert></div>}
      <MasterList
        kind="product"
        newLabel={t("md.newProduct")}
        canCreate={false}
        canEdit={can(me, "products:edit")}
        canArchive={can(me, "products:archive")}
        rows={products.map((p) => ({
          id: p.id,
          title: p.name,
          code: p.code,
          subtitle: [p.name2, p.specifications].filter(Boolean).join(" — ") || undefined,
          archived: !!p.archivedAt,
          badges: p._count.components === 0 ? [{ label: t("md.noRecipeYet"), tone: "amber" as const }] : [],
          links: [{ href: `/products/${p.id}`, label: t("md.recipeLink") }],
          editHref: `/products/${p.id}#edit`,
          facts: [
            { label: t("rc.batchYield"), value: p.batchYield ? p.batchYield.toLocaleString("en") : "—" },
            { label: t("rc.piecesPerCarton"), value: p.piecesPerCarton ? p.piecesPerCarton.toLocaleString("en") : t("rc.noCartons") },
            { label: t("md.recipe"), value: t("md.recipeLines", { n: p._count.components }) },
          ],
          initial: {},
        }))}
      />
    </>
  );
}
