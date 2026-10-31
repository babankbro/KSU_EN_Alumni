"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import {
  consumeResetToken,
  createResetToken,
  emailTaken,
  memberLogin,
  memberLogout,
  passwordProblem,
  startMemberSession,
} from "@/lib/server/member-auth";
import { enqueue } from "@/lib/server/notify";
import { login as staffLogin } from "@/lib/server/auth";

import type { FormState } from "@/lib/form-state";

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const raw = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

/** Only same-site relative paths, so ?next= cannot become an open redirect. */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/me";
}

export async function memberLoginAction(_p: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  const password = raw(fd, "password");
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  const r = await memberLogin(email, password);
  if (r.ok) redirect(safeNext(str(fd, "next")));

  // Staff who use this page instead of /admin/login: a staff email without a
  // member account goes through the staff login (its own lockout and audit).
  const [staff] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM admin_user u
     WHERE lower(u.email) = lower($1) AND u.is_active
       AND NOT EXISTS (SELECT 1 FROM account a WHERE lower(a.email) = lower($1))`,
    [email],
  );
  if (Number(staff?.n ?? 0) > 0) {
    const s = await staffLogin(email, password);
    if (s.ok) redirect("/admin");
    return { error: s.error };
  }
  return { error: r.error };
}

export async function memberLogoutAction(): Promise<void> {
  await memberLogout();
  redirect("/");
}

/** FR-AUTH-04 — always the same answer, so the form cannot reveal which emails have accounts. */
export async function forgotPasswordAction(_p: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fieldErrors: { email: "รูปแบบอีเมลไม่ถูกต้อง" } };

  const created = await createResetToken(email);
  if (created) {
    await enqueue("account", [created.accountId], {
      title: "ตั้งรหัสผ่านใหม่",
      body: "มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีศิษย์เก่าของคุณ ลิงก์นี้ใช้ได้ภายใน 1 ชั่วโมงและใช้ได้ครั้งเดียว\nถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้",
      link: `/reset-password?token=${encodeURIComponent(created.token)}`,
    });
  }
  return { ok: "ถ้ามีบัญชีที่ใช้อีเมลนี้ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว กรุณาตรวจกล่องจดหมาย" };
}

export async function resetPasswordAction(_p: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  const pw = raw(fd, "password");
  const problem = passwordProblem(pw);
  if (problem) return { fieldErrors: { password: problem } };
  if (pw !== raw(fd, "passwordConfirm")) return { fieldErrors: { passwordConfirm: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" } };
  if (!(await consumeResetToken(token, pw))) {
    return { error: "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่" };
  }
  redirect("/login?reset=1");
}

/** FR-AUTH-08 — current students: jobs, news and events, but never the alumni directory. */
export async function studentSignupAction(_p: FormState, fd: FormData): Promise<FormState> {
  const fe: Record<string, string> = {};
  const studentCode = str(fd, "studentCode");
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const email = str(fd, "email");
  const pw = raw(fd, "password");

  if (!/^\d{9,12}$/.test(studentCode)) fe.studentCode = "รหัสนักศึกษาต้องเป็นตัวเลข 9–12 หลัก";
  if (!firstName) fe.firstName = "กรุณากรอกชื่อ";
  if (!lastName) fe.lastName = "กรุณากรอกนามสกุล";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fe.email = "รูปแบบอีเมลไม่ถูกต้อง";
  const problem = passwordProblem(pw);
  if (problem) fe.password = problem;
  else if (pw !== raw(fd, "passwordConfirm")) fe.passwordConfirm = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  if (fd.get("consent") !== "on") fe.consent = "ต้องยอมรับนโยบายความเป็นส่วนตัว";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  if (await emailTaken(email)) return { fieldErrors: { email: "อีเมลนี้มีบัญชีอยู่แล้ว" } };

  const [acc] = await query<{ id: string }>(
    `INSERT INTO account (email, password_hash, role, student_code, display_name)
     VALUES ($1, crypt($2, gen_salt('bf', 12)), 'student', $3, $4) RETURNING id`,
    [email, pw, studentCode, `${firstName} ${lastName}`],
  );
  await query(
    `INSERT INTO audit_log (actor, action, target_table, target_id) VALUES ($1, 'student.signup', 'account', $1)`,
    [acc.id],
  );
  await startMemberSession(acc.id);
  redirect("/me");
}

export async function unsubscribeAction(fd: FormData): Promise<void> {
  const { parseUnsubscribe, unsubscribe } = await import("@/lib/server/notify");
  const parsed = parseUnsubscribe(str(fd, "t"));
  if (!parsed) redirect("/unsubscribe?bad=1");
  await unsubscribe(parsed.accountId, parsed.type);
  revalidatePath("/me/notifications");
  redirect("/unsubscribe?done=1");
}
