import type { Tone } from "@/components/ui";

export type Cell = string | number | Date | null | undefined;
/** One table row. `_href` maps a column key to the page that cell links to. */
export type Row = { [key: string]: Cell | Record<string, string>; _href?: Record<string, string> };

/**
 * How a column is shown. Formatting is shared by the screen, the CSV export and the
 * printable PDF so all three always agree.
 */
export type ColType =
  | "text"
  | "code" // record numbers: left-to-right, monospace
  | "int"
  | "qty" // stock quantities: up to 6 decimals (kg to 1 mg), pieces whole
  | "signed" // stock movements (+ / −)
  | "pct" // 0–100
  | "hours"
  | "days"
  | "date"
  | "datetime"
  | "status" // translated through `ns`, optional badge colour through `tones`
  | "yesno";

export type Column = {
  key: string;
  /** i18n key, e.g. "rep.col.good" */
  label: string;
  type?: ColType;
  ns?: string;
  tones?: Record<string, Tone>;
  /** Sum this column in the totals row. */
  total?: boolean;
  /** Hide on small screens to keep the table readable on a phone. */
  wide?: boolean;
};

export type Kpi = { label: string; value: number | null; type: "int" | "pct" | "hours" | "days"; tone?: "good" | "bad" | "warn" };

export type ReportResult = {
  columns: Column[];
  rows: Row[];
  kpis: Kpi[];
  /** Bar chart: category column + numeric column already present in the rows. */
  chart?: { label: string; value: string; type?: "int" | "pct" | "hours" };
  totals?: boolean;
};

export type FilterKey = "range" | "product" | "item" | "section" | "direction" | "employee" | "ref" | "status" | "group" | "type";

export type ReportQuery = {
  from: string; // YYYY-MM-DD (factory calendar)
  to: string;
  start: Date; // UTC instant, inclusive
  end: Date; // UTC instant, exclusive
  product?: string;
  /** Any stock item (product or ingredient / production item). */
  item?: string;
  section?: "PRODUCT" | "MATERIAL";
  direction?: "IN" | "OUT";
  employee?: string;
  /** Reference / document number typed by the user (text search). */
  ref?: string;
  status?: string;
  group?: string;
  type?: string;
};

/** Who is looking: money columns and values are only added for people who see money. */
export type ReportCtx = { money: boolean };

export type ReportSection = "production" | "orders" | "warehouse" | "money";

export type ReportDef = {
  key: string;
  section: ReportSection;
  icon: string;
  filters: FilterKey[];
  /** Options for the "group by" selector, first is the default. */
  groups?: string[];
  /** i18n namespace of the status filter values and the values themselves. */
  statusFilter?: { ns: string; values: string[] };
  typeFilter?: { ns: string; values: string[] };
  /** Extra permission needed to open this report (e.g. money reports: cash:view). */
  perm?: import("@/lib/permissions").Permission;
  /** Money reports: only for people who buy, sell or see the safe (code review M3). */
  money?: boolean;
  run: (q: ReportQuery, ctx: ReportCtx) => Promise<ReportResult>;
};
