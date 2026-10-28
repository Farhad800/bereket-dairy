import "server-only";
import { db } from "@/lib/db";
import { formatDate, parseFactoryDate } from "@/lib/time";
import type { T } from "./format";
import type { ReportDef, ReportQuery } from "./types";

export type Option = { value: string; label: string };
/** A report filter: a dropdown, or (kind "text") a box to type into, e.g. a reference number. */
export type SelectDef = { name: string; label: string; value: string; options: Option[]; allLabel: string; kind?: "text" };

/** Builds the filters a report needs, with translated labels. */
export async function filterSelects(def: ReportDef, q: ReportQuery, t: T): Promise<SelectDef[]> {
  const f = def.filters;
  const [products, items, users] = await Promise.all([
    f.includes("product") ? db.product.findMany({ where: { archivedAt: null, kind: "PRODUCT" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }) : [],
    f.includes("item") ? db.product.findMany({ where: { archivedAt: null, ...(q.section ? { kind: q.section } : {}) }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true } }) : [],
    f.includes("employee") ? db.user.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }) : [],
  ]);
  const out: SelectDef[] = [];
  const add = (name: keyof ReportQuery, label: string, allLabel: string, options: Option[], kind?: "text") =>
    out.push({ name, label, allLabel, value: String(q[name] ?? ""), options, ...(kind ? { kind } : {}) });

  if (def.groups) add("group", t("rep.f.groupBy"), "", def.groups.map((g) => ({ value: g, label: t(`rep.group.${g}`) })));
  if (f.includes("section")) add("section", t("rep.col.section"), t("rep.f.allSections"), (["PRODUCT", "MATERIAL"] as const).map((k) => ({ value: k, label: t(`md.kindPlural.${k}`) })));
  if (f.includes("product")) add("product", t("rep.col.product"), t("rep.f.allProducts"), products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })));
  if (f.includes("item")) add("item", t("rep.col.item"), t("rep.f.allItems"), items.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })));
  if (f.includes("direction")) add("direction", t("rep.f.direction"), t("rep.f.inAndOut"), [{ value: "IN", label: t("rep.col.in") }, { value: "OUT", label: t("rep.col.out") }]);
  if (f.includes("employee")) add("employee", t("rep.f.employee"), t("rep.f.allEmployees"), users.map((u) => ({ value: u.id, label: u.fullName })));
  if (f.includes("ref")) add("ref", t("rep.col.reference"), "", [], "text");
  if (def.statusFilter) add("status", t("rep.col.status"), t("rep.f.defaultStatus"), def.statusFilter.values.map((v) => ({ value: v, label: t(`${def.statusFilter!.ns}.${v}`) })));
  if (def.typeFilter) add("type", t("rep.col.movement"), t("rep.f.allTypes"), def.typeFilter.values.map((v) => ({ value: v, label: t(`${def.typeFilter!.ns}.${v}`) })));
  return out;
}

/** Human summary of the filters, printed on the PDF and shown under the title. */
export function describeFilters(def: ReportDef, q: ReportQuery, selects: SelectDef[], t: T, locale: string): string[] {
  const parts: string[] = [];
  if (def.filters.includes("range")) parts.push(t("rep.f.period", { from: formatDate(parseFactoryDate(q.from), locale), to: formatDate(parseFactoryDate(q.to), locale) }));
  for (const s of selects) {
    if (!s.value) continue;
    if (s.kind === "text") { parts.push(`${s.label}: ${s.value}`); continue; }
    const o = s.options.find((x) => x.value === s.value);
    if (o) parts.push(`${s.label}: ${o.label}`);
  }
  return parts;
}
