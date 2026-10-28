// Central permission catalogue. Permissions are "resource:action" strings stored on roles.
// Every server action checks one of these on the server — the UI only mirrors it.

export const RESOURCES = [
  "orders",
  "production",
  "warehouse",
  "stock", // stock movement documents: input, output, buy, sell
  "receipts", // printed receipts: saved layouts
  "customers", // customer accounts: balances, sales, payments
  "cash", // the safes: money in, money out (expenses), currency exchange, transfers between safes, expense categories
  "products",
  "reports",
  "users",
  "roles",
  "settings",
  "audit",
] as const;

export const ACTIONS = ["view", "create", "edit", "approve", "export", "archive", "manage", "input", "output", "buy", "sell", "in", "out", "exchange", "transfer"] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type Permission = `${Resource}:${Action}`;

/** Which actions are meaningful for each resource (drives the admin permission matrix). */
export const RESOURCE_ACTIONS: Record<Resource, Action[]> = {
  orders: ["view", "create", "edit", "approve", "export", "archive"],
  production: ["view", "create", "edit", "export"],
  warehouse: ["view", "export"],
  stock: ["view", "input", "output", "buy", "sell"],
  cash: ["view", "in", "out", "exchange", "transfer", "manage", "export"],
  receipts: ["manage"],
  customers: ["view", "manage"],
  products: ["view", "create", "edit", "archive", "export"],
  reports: ["view", "export"],
  users: ["view", "manage"],
  roles: ["view", "manage"],
  settings: ["view", "manage"],
  audit: ["view", "export"],
};

export const ALL_PERMISSIONS: Permission[] = RESOURCES.flatMap((r) =>
  RESOURCE_ACTIONS[r].map((a) => `${r}:${a}` as Permission),
);

/** Global visibility rule: every active employee can read all factory business records. */
export const BUSINESS_VIEW: Permission[] = [
  "orders:view",
  "production:view",
  "warehouse:view",
  "stock:view",
  "products:view",
  "reports:view",
  "users:view",
];

const p = (...list: Permission[]) => list;

export const DEFAULT_ROLES: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: "Administrator",
    description: "Full control of the system, employees, roles and settings.",
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "Accountant",
    description: "Purchases, sales, customers, safes, costs and stock value. Sees all money.",
    permissions: p(
      ...BUSINESS_VIEW,
      "stock:input", "stock:output", "stock:buy", "stock:sell",
      "customers:view", "customers:manage",
      "cash:view", "cash:in", "cash:out", "cash:exchange", "cash:transfer", "cash:manage", "cash:export",
      "receipts:manage",
      "products:create", "products:edit", "products:export",
      "warehouse:export", "production:export", "orders:export",
      "reports:export",
      "audit:view",
    ),
  },
  {
    name: "Sales Manager",
    description: "Gives production the order sheets: products and amounts.",
    permissions: p(
      ...BUSINESS_VIEW,
      "orders:create", "orders:edit", "orders:approve", "orders:export", "orders:archive",
      "reports:export",
    ),
  },
  {
    name: "Production Team",
    description: "Enters each production run: product, batches made and pieces produced.",
    permissions: p(
      ...BUSINESS_VIEW,
      "production:create", "production:edit",
    ),
  },
  {
    name: "Warehouse Team",
    description: "Records items coming in and going out. Sees quantities only — never prices or money.",
    permissions: p(
      ...BUSINESS_VIEW,
      "warehouse:export", "reports:export", // quantity reports only: money reports stay closed (they need buy / sell / safe)
      "stock:input", "stock:output",
    ),
  },
];

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}
