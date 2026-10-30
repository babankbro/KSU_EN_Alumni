import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { query } from "@/lib/server/db";
import { authorizeUrl, exchangeCode, lineLoginEnabled } from "@/lib/server/line";
import { getMemberAccount, startMemberSession } from "@/lib/server/member-auth";
import { appUrl } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "ksu_line_state";

/**
 * GET /api/auth/line/start    — begin LINE Login (or link LINE to the signed-in account)
 * GET /api/auth/line/callback — LINE redirects back here
 *
 * LINE identifies a person, not an alumnus, so it can only sign in to an
 * account that already linked LINE from /me/settings. An unknown LINE user is
 * sent to registration rather than getting a new, unverified account.
 */
export async function GET(req: Request, ctx: { params: Promise<{ step: string }> }) {
  const { step } = await ctx.params;
  if (!lineLoginEnabled()) return NextResponse.redirect(appUrl("/login?line=disabled"));

  const jar = await cookies();

  if (step === "start") {
    const state = randomBytes(16).toString("hex");
    jar.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.COOKIE_SECURE === "true" });
    return NextResponse.redirect(authorizeUrl(state));
  }

  if (step !== "callback") return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  // CSRF protection for the OAuth round trip.
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(appUrl("/login?line=failed"));
  }

  let profile: { userId: string };
  try {
    profile = await exchangeCode(code);
  } catch (err) {
    console.error("[line]", err);
    return NextResponse.redirect(appUrl("/login?line=failed"));
  }

  const current = await getMemberAccount();
  if (current) {
    // Linking LINE to an account that is already signed in.
    await query(`UPDATE account SET line_user_id = NULL WHERE line_user_id = $1 AND id <> $2`, [profile.userId, current.id]);
    await query(`UPDATE account SET line_user_id = $1 WHERE id = $2`, [profile.userId, current.id]);
    return NextResponse.redirect(appUrl("/me/settings?line=linked"));
  }

  const [acc] = await query<{ id: string }>(`SELECT id FROM account WHERE line_user_id = $1 AND is_active`, [profile.userId]);
  if (!acc) return NextResponse.redirect(appUrl("/login?line=unlinked"));
  await startMemberSession(acc.id);
  return NextResponse.redirect(appUrl("/me"));
}
