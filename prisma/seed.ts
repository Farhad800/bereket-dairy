/**
 * Baseline setup — safe to run any number of times (idempotent).
 * Creates departments, built-in roles, settings,
 * and the FIRST administrator only if no administrator exists yet.
 *
 *   ADMIN_USERNAME=admin ADMIN_FULLNAME="..." npm run db:seed
 *
 * If ADMIN_PASSWORD is not set, a strong temporary password is generated and printed ONCE.
 * The admin must change it at first sign-in.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { ALL_PERMISSIONS, DEFAULT_ROLES } from "../src/lib/permissions";

const db = new PrismaClient();

const DEPARTMENTS = [
  ["ADMIN", "Administration"],
  ["SALES", "Sales & Planning"],
  ["PROD", "Production"],
  ["WH", "Warehouse"],
  ["ACC", "Accounts"],
];


async function main() {
  for (const [code, name] of DEPARTMENTS) {
    await db.department.upsert({ where: { code }, update: {}, create: { code, name } });
  }

  for (const r of DEFAULT_ROLES) {
    const existing = await db.role.findUnique({ where: { name: r.name } });
    if (!existing) {
      await db.role.create({
        data: { name: r.name, description: r.description, isSystem: true, permissions: { create: r.permissions.map((permission) => ({ permission })) } },
      });
      console.log(`  role created: ${r.name}`);
    }
  }
  // Administrator always keeps every permission (including ones added in new versions).
  const admin = await db.role.findUniqueOrThrow({ where: { name: "Administrator" } });
  await db.rolePermission.createMany({
    data: ALL_PERMISSIONS.map((permission) => ({ roleId: admin.id, permission })),
    skipDuplicates: true,
  });

  const settings: Record<string, unknown> = {
    "factory.name": "Bereket Dairy",
    "factory.timezone": process.env.FACTORY_TIMEZONE ?? "Asia/Baghdad",
    "units": { products: "pcs", ingredients: ["kg", "pcs"] },
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }

  const hasAdmin = await db.user.count({ where: { roleId: admin.id, active: true } });
  // On Vercel the first admin is created through the /setup page instead, so no password ever appears in build logs.
  if (!hasAdmin && process.env.SEED_SKIP_ADMIN === "1") {
    console.log("No administrator yet — open /setup on the site to create one.");
  } else if (!hasAdmin) {
    const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    const adminDept = await db.department.findUnique({ where: { code: "ADMIN" } });
    await db.user.create({
      data: {
        employeeId: process.env.ADMIN_EMPLOYEE_ID ?? "0001",
        fullName: process.env.ADMIN_FULLNAME ?? "System Administrator",
        username,
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true,
        roleId: admin.id,
        departmentId: adminDept?.id,
      },
    });
    console.log("\n  ┌─────────────────────────────────────────────");
    console.log(`  │ First administrator created`);
    console.log(`  │ username: ${username}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`  │ temporary password: ${password}`);
    console.log("  │ You will be asked to change it at first sign-in.");
    console.log("  └─────────────────────────────────────────────\n");
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
