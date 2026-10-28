/**
 * Demonstration data — SYNTHETIC, clearly tagged so it can be removed before going live.
 *   npm run demo:add      → creates demo employees (one per role) and demo items / one demo product
 *   npm run demo:remove   → deletes everything tagged DEMO
 *
 * Every demo record uses the "DEMO" marker (usernames start with "demo.", codes with "DEMO-").
 * No stock is created: stock only comes in through documents (Buy / Input), like real stock.
 * Refuses to run against production unless ALLOW_DEMO=1 is set.
 */
import { PrismaClient, type ComponentBasis } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_PASSWORD = "Demo12345!"; // demo accounts only; removed with demo:remove

const DEMO_USERS = [
  ["D-101", "Sara Sales (demo)", "demo.sales", "Sales Manager", "SALES"],
  ["D-102", "Peter Production (demo)", "demo.production", "Production Team", "PROD"],
  ["D-105", "Walid Warehouse (demo)", "demo.warehouse", "Warehouse Team", "WH"],
  ["D-106", "Amina Accountant (demo)", "demo.accountant", "Accountant", "ACC"],
] as const;

async function add() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const [employeeId, fullName, username, roleName, dept] of DEMO_USERS) {
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    const department = await db.department.findUnique({ where: { code: dept } });
    await db.user.upsert({
      where: { username },
      update: {},
      create: { employeeId, fullName, username, passwordHash: hash, mustChangePassword: false, roleId: role.id, departmentId: department?.id },
    });
  }
  console.log(`Demo employees ready (password for all: ${DEMO_PASSWORD}):`);
  DEMO_USERS.forEach((u) => console.log(`  ${u[2].padEnd(18)} ${u[3]}`));

  // Synthetic ingredients and production items (codes start with DEMO-). Not the factory's real list.
  const items = [
    ["DEMO-MILK", "Milk (demo)", "kg", 650],
    ["DEMO-SUGAR", "Sugar (demo)", "kg", 1200],
    ["DEMO-CULTURE", "Yoghurt culture (demo)", "kg", 900000],
    ["DEMO-CUP500", "500 g cup (demo)", "pcs", 45],
    ["DEMO-LID", "Cup lid (demo)", "pcs", 15],
    ["DEMO-CARTON", "Carton for 12 cups (demo)", "pcs", 300],
  ] as const;
  for (const [code, name, unit, cost] of items) {
    await db.product.upsert({ where: { code }, update: {}, create: { code, name, unit, kind: "MATERIAL", costPrice: cost, costCurrency: "IQD", costRate: 1, costIqd: cost, costUpdatedAt: new Date() } });
  }
  const p = await db.product.upsert({
    where: { code: "DEMO-YOG500" }, update: {},
    create: { code: "DEMO-YOG500", name: "Yoghurt 500 g (demo)", kind: "PRODUCT", unit: "pcs", batchYield: 950, piecesPerCarton: 12 },
  });
  if (!(await db.productComponent.count({ where: { productId: p.id } }))) {
    const id = async (code: string) => (await db.product.findUniqueOrThrow({ where: { code } })).id;
    const lines: [string, number, ComponentBasis][] = [
      ["DEMO-MILK", 500, "BATCH"], ["DEMO-SUGAR", 20, "BATCH"], ["DEMO-CULTURE", 0.0004, "BATCH"],
      ["DEMO-CUP500", 1, "PIECE"], ["DEMO-LID", 1, "PIECE"], ["DEMO-CARTON", 1, "CARTON"],
    ];
    for (const [code, qty, per] of lines) await db.productComponent.create({ data: { productId: p.id, componentId: await id(code), qty, per } });
  }
  console.log("Demo items and one demo product ready (codes start with DEMO-). No stock: add it with a Buy or Input document.");
}

async function remove() {
  const users = await db.user.findMany({ where: { username: { startsWith: "demo." } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.$transaction([
    db.session.deleteMany({ where: { userId: { in: ids } } }),
    db.notification.deleteMany({ where: { userId: { in: ids } } }),
    db.auditLog.updateMany({ where: { userId: { in: ids } }, data: { userId: null } }),
    db.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`Removed ${ids.length} demo employees.`);
  try {
    await db.productComponent.deleteMany({ where: { product: { code: { startsWith: "DEMO-" } } } });
    const r = await db.product.deleteMany({ where: { code: { startsWith: "DEMO-" } } });
    if (r.count) console.log(`Removed ${r.count} demo items.`);
  } catch {
    console.log("Kept demo items: orders, production or stock still use them. Clear test data first (Administration → System).");
  }
}

const cmd = process.argv[2];
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO !== "1") {
  console.error("Refusing to touch demo data in production without ALLOW_DEMO=1.");
  process.exit(1);
}
(cmd === "remove" ? remove() : add())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
