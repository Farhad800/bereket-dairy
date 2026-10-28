/**
 * READ-ONLY integrity check for the dairy stock rules. It changes NOTHING:
 * everything runs inside a READ ONLY transaction, so even a mistake here cannot write.
 *
 *   DATABASE_URL=... npx tsx scripts/check-integrity.ts
 *
 * Checks:
 *  1. stock from production equals what the production entries say (per product);
 *  2. no item's stock has ever been below zero, at any point in the ledger;
 *  3. no production entry has a negative use of an item (gave back more than it took).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const report = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const production = await tx.$queryRaw<{ code: string; entries: number; movements: number }[]>`
      SELECT p.code, COALESCE(e.q, 0)::float AS entries, COALESCE(m.q, 0)::float AS movements
      FROM "Product" p
      LEFT JOIN (SELECT "productId", SUM(quantity) q FROM "ProductionEntry" GROUP BY 1) e ON e."productId" = p.id
      LEFT JOIN (SELECT "productId", SUM(qty) q FROM "StockMovement" WHERE type = 'PRODUCTION' AND "entryId" IS NOT NULL GROUP BY 1) m ON m."productId" = p.id
      WHERE COALESCE(e.q, 0) <> COALESCE(m.q, 0)
      ORDER BY p.code`;
    const negative = await tx.$queryRaw<{ code: string; at: Date; low: number }[]>`
      SELECT p.code, t."createdAt" AS at, t.run::float AS low FROM (
        SELECT "productId", "createdAt", SUM(qty) OVER (PARTITION BY "productId" ORDER BY "createdAt", id) AS run FROM "StockMovement"
      ) t JOIN "Product" p ON p.id = t."productId" WHERE t.run < -0.0000001 ORDER BY t."createdAt"`;
    const overReturned = await tx.$queryRaw<{ code: string; day: string; qty: number }[]>`
      SELECT p.code, e.day::text AS day, SUM(m.qty)::float AS qty
      FROM "StockMovement" m JOIN "ProductionEntry" e ON e.id = m."entryId" JOIN "Product" p ON p.id = m."productId"
      WHERE m.type = 'USE' GROUP BY p.code, e.day, e.id HAVING SUM(m.qty) > 0.0000001`;
    return { production, negative, overReturned };
  });

  const line = (s: string) => console.log(s);
  line("Bereket Dairy — read-only integrity check");
  line(`1. Production stock ≠ production entries: ${report.production.length}`);
  for (const r of report.production) line(`   ${r.code}: entries ${r.entries}, stock movements ${r.movements}`);
  line(`2. Moments when an item was below zero: ${report.negative.length}`);
  for (const r of report.negative.slice(0, 50)) line(`   ${r.code} at ${r.at.toISOString()}: ${r.low}`);
  line(`3. Production entries that gave back more than they used: ${report.overReturned.length}`);
  for (const r of report.overReturned) line(`   ${r.code} ${r.day}: +${r.qty}`);
  const problems = report.production.length + report.negative.length + report.overReturned.length;
  line(problems === 0 ? "Result: no inconsistencies found." : `Result: ${problems} record(s) need a look. Nothing was changed.`);
}

main().catch((e) => { console.error("Check failed:", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
