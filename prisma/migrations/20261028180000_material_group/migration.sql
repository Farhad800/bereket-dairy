-- Split ingredients & production items into Raw materials and Packaging.
CREATE TYPE "MaterialGroup" AS ENUM ('RAW', 'PACKAGING');
ALTER TABLE "Product" ADD COLUMN "materialGroup" "MaterialGroup";
-- Items that already exist are raw materials until someone moves them.
UPDATE "Product" SET "materialGroup" = 'RAW' WHERE "kind" = 'MATERIAL';
CREATE INDEX "Product_kind_materialGroup_idx" ON "Product"("kind", "materialGroup");
