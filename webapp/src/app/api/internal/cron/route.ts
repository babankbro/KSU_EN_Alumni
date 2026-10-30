import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runCron } from "@/lib/server/cron";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/cron — called once a minute by the `cron` service.
 * Protected by CRON_SECRET; without it configured the endpoint refuses to run.
 */
export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Not found", { status: 404 });
  }
  return NextResponse.json(await runCron());
}
