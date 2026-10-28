import type { Prisma } from "@prisma/client";

/**
 * Warehouse sections: finished products, and ingredients & production items split into
 * raw materials and packaging (Product.materialGroup). "MATERIAL" = both of the last two.
 */
export const SECTIONS = ["PRODUCT", "RAW", "PACKAGING"] as const;
export type Section = (typeof SECTIONS)[number];
export type SectionFilter = Section | "MATERIAL";

export function sectionOf(p: { kind: string; materialGroup?: string | null }): Section {
  if (p.kind === "PRODUCT") return "PRODUCT";
  return p.materialGroup === "PACKAGING" ? "PACKAGING" : "RAW";
}

export function sectionWhere(s: SectionFilter): Prisma.ProductWhereInput {
  if (s === "PRODUCT") return { kind: "PRODUCT" };
  if (s === "MATERIAL") return { kind: "MATERIAL" };
  if (s === "PACKAGING") return { kind: "MATERIAL", materialGroup: "PACKAGING" };
  return { kind: "MATERIAL", OR: [{ materialGroup: "RAW" }, { materialGroup: null }] };
}

export const isSectionFilter = (v: unknown): v is SectionFilter => v === "PRODUCT" || v === "RAW" || v === "PACKAGING" || v === "MATERIAL";
