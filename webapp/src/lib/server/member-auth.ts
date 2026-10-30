import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPool, query } from "./db";
import { newToken, sha256 } from "./tokens";
import { hit, isLimited, LIMITS } from "./rate-limit";
import { getAdminSession, type AdminSession } from "./auth";

/**
 * Accounts for alumni and current students (FR-AUTH-04/07/08).
 * Kept apart from staff accounts on purpose: different tables, cookie and
 * lifetime, so a leaked member session can never reach the back office.
 */

export const MEMBER_COOKIE = "ksu_member_session";
const SESSION_DAYS = 30;

export interface MemberAccount {
  id: string;
  email: string;
  displayName: string;
  role: "alumni" | "student";
  alumniId: string | null;
  /** alumni.claim_status, or null for students / unlinked accounts */
  claimStatus: "unclaimed" | "pending" | "verified" | "rejected" | null;
  admissionYear: number | null;
  isTrustedPoster: boolean;
  lineLinked: boolean;
}

/**
 * Who is looking at the page (FR-AUTH-07). Every visibility decision on the
 * public site goes through this, so there is one place that defines what
 * "members only" means: a verified alumnus, or signed-in staff.
 */
export type Viewer =
  | { kind: "anonymous" }
  | { kind: "student"; account: MemberAccount }
  | { kind: "alumni"; account: MemberAccount; verified: boolean }
  | { kind: "staff"; staff: AdminSession };

export function isMember(v: Viewer): boolean {
  return v.kind === "staff" || (v.kind === "alumni" && v.verified);
}

export function viewerAccount(v: Viewer): MemberAccount | null {
  return v.kind === "alumni" || v.kind === "student" ? v.account : null;
}

/* ---------------- passwords ---------------- */

export { passwordProblem } from "../registration";

/* ---------------- sessions ---------------- */

export async function startMemberSession(accountId: string): Promise<void> {
  const { token, hash } = newToken();
  const ua = (await headers()).get("user-agent");
  await query(
    `INSERT INTO account_session (token_hash, account_id, expires_at, user_agent)
     VALUES ($1, $2, now() + make_interval(days => $3), $4)`,
    [hash, accountId, SESSION_DAYS, ua],
  );
  await query(`UPDATE account SET last_login_at = now() WHERE id = $1`, [accountId]);
  (await cookies()).set(MEMBER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function getMemberAccount(): Promise<MemberAccount | null> {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  try {
    const [r] = await query<{
      id: string; email: string; display_name: string; role: "alumni" | "student";
      alumni_id: string | null; claim_status: MemberAccount["claimStatus"]; admission_year: number | null;
      is_trusted_poster: boolean; line_user_id: string | null;
    }>(
      `SELECT ac.id, ac.email, ac.display_name, ac.role::text AS role, ac.alumni_id,
              a.claim_status::text AS claim_status, a.admission_year, ac.is_trusted_poster, ac.line_user_id
       FROM account_session s
       JOIN account ac ON ac.id = s.account_id
       LEFT JOIN alumni a ON a.id = ac.alumni_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND ac.is_active`,
      [sha256(token)],
    );
    if (!r) return null;
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      alumniId: r.alumni_id,
      claimStatus: r.claim_status,
      admissionYear: r.admission_year,
      isTrustedPoster: r.is_trusted_poster,
      lineLinked: Boolean(r.line_user_id),
    };
  } catch (err) {
    console.error("[member-auth] session lookup failed", err);
    return null;
  }
}

export async function getViewer(): Promise<Viewer> {
  const account = await getMemberAccount();
  if (account) {
    if (account.role === "student") return { kind: "student", account };
    return { kind: "alumni", account, verified: account.claimStatus === "verified" };
  }
  const staff = await getAdminSession();
  return staff ? { kind: "staff", staff } : { kind: "anonymous" };
}

/** For /me pages and member actions. */
export async function requireMember(opts: { verified?: boolean; alumni?: boolean } = {}): Promise<MemberAccount> {
  const account = await getMemberAccount();
  if (!account) redirect("/login");
  if (opts.alumni && account.role !== "alumni") redirect("/me?need=alumni");
  if (opts.verified && account.claimStatus !== "verified") redirect("/me?need=verified");
  return account;
}

export async function memberLogout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(MEMBER_COOKIE)?.value;
  if (token) await query(`DELETE FROM account_session WHERE token_hash = $1`, [sha256(token)]).catch(() => undefined);
  jar.delete(MEMBER_COOKIE);
}

/* ---------------- login ---------------- */

export async function memberLogin(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = email.trim().toLowerCase();
  if (await isLimited(LIMITS.memberLoginFailure, key)) {
    return { ok: false, error: "เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่ หรือกด “ลืมรหัสผ่าน”" };
  }
  const [acc] = await query<{ id: string }>(
    `SELECT id FROM account
     WHERE lower(email) = $1 AND is_active AND password_hash IS NOT NULL
       AND password_hash = crypt($2, password_hash)`,
    [key, password],
  );
  if (!acc) {
    await hit(LIMITS.memberLoginFailure, key);
    return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  await startMemberSession(acc.id);
  return { ok: true };
}

/* ---------------- account creation (used by registration and student sign-up) ---------------- */

export async function emailTaken(email: string): Promise<boolean> {
  const [r] = await query<{ n: string }>(`SELECT count(*) AS n FROM account WHERE lower(email) = lower($1)`, [email.trim()]);
  return Number(r?.n ?? 0) > 0;
}

/* ---------------- password reset ---------------- */

export async function createResetToken(email: string): Promise<{ accountId: string; token: string } | null> {
  const key = email.trim().toLowerCase();
  if (await hit(LIMITS.passwordReset, key)) return null;
  const [acc] = await query<{ id: string }>(`SELECT id FROM account WHERE lower(email) = $1 AND is_active`, [key]);
  if (!acc) return null;
  const { token, hash } = newToken();
  await query(
    `INSERT INTO account_token (token_hash, account_id, purpose, expires_at)
     VALUES ($1, $2, 'reset_password', now() + interval '1 hour')`,
    [hash, acc.id],
  );
  return { accountId: acc.id, token };
}

export async function consumeResetToken(token: string, newPassword: string): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const [t] = (
      await client.query<{ account_id: string }>(
        `UPDATE account_token SET used_at = now()
         WHERE token_hash = $1 AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > now()
         RETURNING account_id`,
        [sha256(token)],
      )
    ).rows;
    if (!t) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(`UPDATE account SET password_hash = crypt($2, gen_salt('bf', 12)) WHERE id = $1`, [
      t.account_id,
      newPassword,
    ]);
    // A reset signs out every other device.
    await client.query(`DELETE FROM account_session WHERE account_id = $1`, [t.account_id]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
