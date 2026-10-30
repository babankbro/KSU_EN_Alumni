"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool, query } from "@/lib/server/db";
import { audit, requireAdmin, type AdminRole } from "@/lib/server/auth";
import type { FormState } from "@/lib/form-state";

/**
 * Staff accounts and roles (FR-ADM-03) — admins only. There is always at
 * least one active admin, and nobody can lock themselves out.
 */

const ROLES: AdminRole[] = ["admin", "editor", "faculty"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

function staffPasswordProblem(pw: string): string | null {
  if (pw.length < 12) return "รหัสผ่านเจ้าหน้าที่ต้องยาวอย่างน้อย 12 ตัวอักษร";
  if (pw.length > 128) return "รหัสผ่านยาวเกินไป";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "ต้องมีทั้งตัวอักษรและตัวเลข";
  return null;
}

export async function createStaffAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin("admin");
  const email = str(fd, "email").toLowerCase();
  const displayName = str(fd, "displayName");
  const role = str(fd, "role") as AdminRole;
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";

  const fe: Record<string, string> = {};
  if (!EMAIL.test(email)) fe.email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (!displayName || displayName.length > 100) fe.displayName = "กรุณาระบุชื่อที่แสดง";
  if (!ROLES.includes(role)) fe.role = "กรุณาเลือกบทบาท";
  const pwErr = staffPasswordProblem(password);
  if (pwErr) fe.password = pwErr;
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  const [dup] = await query(`SELECT 1 FROM admin_user WHERE lower(email) = $1`, [email]);
  if (dup) return { fieldErrors: { email: "อีเมลนี้มีบัญชีเจ้าหน้าที่แล้ว" } };

  const [row] = await query<{ id: string }>(
    `INSERT INTO admin_user (email, display_name, password_hash, role) VALUES ($1, $2, crypt($3, gen_salt('bf', 12)), $4::admin_role) RETURNING id`,
    [email, displayName, password, role],
  );
  await audit(session, "staff.create", "admin_user", row.id, { email, role });
  revalidatePath("/admin/staff");
  return { ok: `สร้างบัญชี ${email} แล้ว — แจ้งรหัสผ่านชั่วคราวให้เจ้าของบัญชีทางช่องทางที่ปลอดภัย และให้เปลี่ยนหลังเข้าใช้ครั้งแรก` };
}

export async function updateStaffAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const staffId = str(fd, "staffId");
  const intent = str(fd, "intent");
  const back = (done: string) => redirect(`/admin/staff?done=${done}`);
  if (!/^[0-9a-f-]{36}$/i.test(staffId)) back("invalid");
  if (staffId === session.id && intent !== "password") back("self");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Serialise changes that could remove the last active admin.
    await client.query(`SELECT id FROM admin_user WHERE role = 'admin' FOR UPDATE`);
    const { rows: [target] } = await client.query<{ role: AdminRole; is_active: boolean; email: string }>(
      `SELECT role::text AS role, is_active, email FROM admin_user WHERE id = $1`,
      [staffId],
    );
    if (!target) {
      await client.query("ROLLBACK");
      back("invalid");
    }
    const { rows: [{ n }] } = await client.query<{ n: string }>(`SELECT count(*) AS n FROM admin_user WHERE role = 'admin' AND is_active`);
    const lastAdmin = target.role === "admin" && target.is_active && Number(n) <= 1;

    if (intent === "role") {
      const role = str(fd, "role") as AdminRole;
      if (!ROLES.includes(role)) throw new Error("bad role");
      if (lastAdmin && role !== "admin") {
        await client.query("ROLLBACK");
        back("last_admin");
      }
      await client.query(`UPDATE admin_user SET role = $2::admin_role WHERE id = $1`, [staffId, role]);
      await client.query(`DELETE FROM admin_session WHERE admin_id = $1`, [staffId]); // new role on next sign-in
    } else if (intent === "toggle") {
      if (lastAdmin && target.is_active) {
        await client.query("ROLLBACK");
        back("last_admin");
      }
      await client.query(`UPDATE admin_user SET is_active = NOT is_active WHERE id = $1`, [staffId]);
      await client.query(`DELETE FROM admin_session WHERE admin_id = $1`, [staffId]);
    } else if (intent === "password") {
      const pw = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
      if (staffPasswordProblem(pw)) {
        await client.query("ROLLBACK");
        back("weak_password");
      }
      await client.query(`UPDATE admin_user SET password_hash = crypt($2, gen_salt('bf', 12)) WHERE id = $1`, [staffId, pw]);
      // Other devices are signed out; the admin changing their own password keeps this session.
      await client.query(`DELETE FROM admin_session WHERE admin_id = $1 AND admin_id <> $2`, [staffId, session.id]);
    } else {
      await client.query("ROLLBACK");
      back("invalid");
    }
    await client.query("COMMIT");
    await audit(session, `staff.${intent}`, "admin_user", staffId, { email: target.email, role: str(fd, "role") || undefined });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/admin/staff");
  back(intent);
}
