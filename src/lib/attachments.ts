import "server-only";
import { db } from "./db";
import { canSeeMoney } from "./auth";

/**
 * Which records can carry files (scanned delivery notes, invoices…), and who may see / add them.
 * Dairy: stock documents only. A Buy or Sell document's paper shows prices, so its files are for
 * people who see money; Input / Output papers are for everyone who follows stock.
 */
export const ATTACHABLE_TYPES = ["StockDoc"] as const;
export type AttachableType = (typeof ATTACHABLE_TYPES)[number];
export const isAttachable = (v: string): v is AttachableType => (ATTACHABLE_TYPES as readonly string[]).includes(v);

type Who = { permissions: Set<string> };
const ADD = { INPUT: "stock:input", OUTPUT: "stock:output", BUY: "stock:buy", SELL: "stock:sell" } as const;

/** null = the record doesn't exist; otherwise whether this person may view / add files on it. */
export async function attachmentAccess(entityType: AttachableType, entityId: string, me: Who): Promise<{ view: boolean; add: boolean } | null> {
  if (entityType === "StockDoc") {
    const d = await db.stockDoc.findUnique({ where: { id: entityId }, select: { type: true } });
    if (!d) return null;
    const money = d.type === "BUY" || d.type === "SELL";
    const view = me.permissions.has("stock:view") && (!money || canSeeMoney(me));
    return { view, add: view && me.permissions.has(ADD[d.type]) };
  }
  return null;
}
