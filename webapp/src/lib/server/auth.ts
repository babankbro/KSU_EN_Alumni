import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { getPool, query } from "./db";
import { clientIpFrom } from "./client-ip";

/**
 * Staff authentication for the back office (FR-ADM-10 … FR-ADM-12).
 *
 * - Passwords: bcrypt through pgcrypto's crypt(), the same primitive the
 *   schema already uses for the ID-digit hash.
 * - Sessions: a random 256-bit token in an httpOnly cookie; the database keeps
 *   only its SHA-256, so a leaked table does not yield usable sessions.
 * - Lockout: five failures per email within 15 minutes. A per-IP limit
 *   (thirty) applies only when the IP is trustworthy — see client-ip.ts.
 */

export const SESSION_COOKIE = "ksu_admin_session";
const SESSION_HOURS = 8;
const MAX_FAILURES = 5; // per email
// Per IP, and only with TRUST_PROXY=true. Higher than the per-email limit
// because one office NAT can sit in front of many staff.
const MAX_FAILURES_PER_IP = 30;
const FAILURE_WINDOW_MIN = 15;

export type AdminRole = "admin" | "editor";

export interface AdminSession {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function clientMeta() {
  const h = await headers();
  return { ip: clientIpFrom(h), userAgent: h.get("user-agent") };
}

/**
 * Creates the first admin from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD
 * when — and only when — no admin account exists yet. After that the
 * variables are ignored, so leaving them set cannot reset a changed password.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) {
    console.warn("[auth] ADMIN_BOOTSTRAP_PASSWORD shorter than 12 characters — bootstrap skipped");
    return;
  }

  await query(
    `INSERT INTO admin_user (email, display_name, password_hash, role)
     SELECT $1, 'ผู้ดูแลระบบ', crypt($2, gen_salt('bf', 12)), 'admin'
     WHERE NOT EXISTS (SELECT 1 FROM admin_user)`,
    [email, password],
  );
}

async function isLockedOut(email: string, ip: string | null): Promise<boolean> {
  const [row] = await query<{ by_email: string; by_ip: string }>(
    `SELECT
       count(*) FILTER (WHERE detail->>'email' = $1) AS by_email,
       count(*) FILTER (WHERE $2::inet IS NOT NULL AND ip_address = $2::inet) AS by_ip
     FROM audit_log
     WHERE action = 'admin.login_failed'
       AND created_at > now() - make_interval(mins => $3)`,
    [email, ip, FAILURE_WINDOW_MIN],
  );
  return Number(row?.by_email ?? 0) >= MAX_FAILURES || Number(row?.by_ip ?? 0) >= MAX_FAILURES_PER_IP;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const { ip, userAgent } = await clientMeta();
  const normalised = email.trim().toLowerCase();

  await ensureBootstrapAdmin();

  if (await isLockedOut(normalised, ip)) {
    return {
      ok: false,
      error: `เข้าสู่ระบบผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารอ ${FAILURE_WINDOW_MIN} นาทีแล้วลองใหม่`,
    };
  }

  const [user] = await query<{ id: string }>(
    `SELECT id FROM admin_user
     WHERE lower(email) = $1 AND is_active AND password_hash = crypt($2, password_hash)`,
    [normalised, password],
  );

  if (!user) {
    await query(
      `INSERT INTO audit_log (actor, action, detail, ip_address)
       VALUES ('anonymous', 'admin.login_failed', jsonb_build_object('email', $1::text), $2)`,
      [normalised, ip],
    );
    // Same message whether the email exists or not, so accounts cannot be enumerated.
    return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  const token = randomBytes(32).toString("base64url");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO admin_session (token_hash, admin_id, expires_at, ip_address, user_agent)
       VALUES ($1, $2, now() + make_interval(hours => $3), $4, $5)`,
      [sha256(token), user.id, SESSION_HOURS, ip, userAgent],
    );
    await client.query(`UPDATE admin_user SET last_login_at = now() WHERE id = $1`, [user.id]);
    // Opportunistic cleanup keeps the table small without a cron job.
    await client.query(`DELETE FROM admin_session WHERE expires_at < now()`);
    await client.query(
      `INSERT INTO audit_log (actor, action, target_table, target_id, ip_address)
       VALUES ($1, 'admin.login', 'admin_user', $1, $2)`,
      [user.id, ip],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Off by default because the local stack is plain HTTP; set
    // COOKIE_SECURE=true behind HTTPS.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });

  return { ok: true };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const [row] = await query<{ id: string; email: string; display_name: string; role: AdminRole }>(
      `SELECT u.id, u.email, u.display_name, u.role::text AS role
       FROM admin_session s JOIN admin_user u ON u.id = s.admin_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active`,
      [sha256(token)],
    );
    return row ? { id: row.id, email: row.email, displayName: row.display_name, role: row.role } : null;
  } catch (err) {
    console.error("[auth] session lookup failed", err);
    return null;
  }
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(role?: AdminRole): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (role === "admin" && session.role !== "admin") redirect("/admin?denied=1");
  return session;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await query(`DELETE FROM admin_session WHERE token_hash = $1`, [sha256(token)]).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

export async function audit(
  session: AdminSession,
  action: string,
  targetTable: string,
  targetId: string | number,
  detail?: Record<string, unknown>,
): Promise<void> {
  const { ip } = await clientMeta();
  await query(
    `INSERT INTO audit_log (actor, action, target_table, target_id, detail, ip_address)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [session.id, action, targetTable, String(targetId), detail ? JSON.stringify(detail) : null, ip],
  );
}
