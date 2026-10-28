import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { ImportRefused, importOpeningStock, payloadSchema } from "@/lib/opening-import";

/**
 * One-time opening-stock import (see src/lib/opening-import.ts).
 * Switched on only while OPENING_IMPORT_TOKEN (32+ characters) is set in the server environment;
 * otherwise this address does not exist. The caller sends the same value in the x-import-token header.
 * ?dry=1 checks everything and rolls back.
 */
export const maxDuration = 300;

function allowed(req: Request) {
  const want = process.env.OPENING_IMPORT_TOKEN ?? "";
  const got = req.headers.get("x-import-token") ?? "";
  if (want.length < 32 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function POST(req: Request) {
  if (!allowed(req)) return new Response("Not found", { status: 404 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  try {
    const payload = payloadSchema.parse(await req.json());
    const result = await importOpeningStock(payload, dry);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ImportRefused) return Response.json({ ok: false, error: e.message }, { status: 409 });
    if (e instanceof ZodError) return Response.json({ ok: false, error: e.issues.slice(0, 10) }, { status: 400 });
    console.error(JSON.stringify({ level: "error", where: "opening-import", message: e instanceof Error ? e.message : String(e) }));
    return Response.json({ ok: false, error: "Import failed; nothing was saved." }, { status: 500 });
  }
}

export async function GET() {
  return new Response("Not found", { status: 404 });
}
