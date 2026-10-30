"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool, query } from "@/lib/server/db";
import { memberLogout, passwordProblem, requireMember } from "@/lib/server/member-auth";
import { recomputeCompleteness, touchProfile, VIS_FIELDS } from "@/lib/server/profile";
import { storeUpload, UploadError } from "@/lib/server/files";
import { NOTIF_TYPES } from "@/lib/server/notify";
import type { FormState } from "@/lib/form-state";

/**
 * Owner-side profile actions (FR-PROF-01 … 10, FR-NOTI-03, FR-AUTH-03).
 * Every action resolves the alumni row from the session — never from a form
 * field — so nobody can edit another person's profile by changing an id.
 */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const THAI = /^[฀-๿\s.'’-]+$/;
const LATIN = /^[A-Za-z\s.'’-]+$/;

async function alumniOf() {
  const acc = await requireMember({ alumni: true });
  if (!acc.alumniId) redirect("/me?need=alumni");
  return { acc, alumniId: acc.alumniId };
}

async function audit(accountId: string, action: string, targetId: string, detail?: Record<string, unknown>) {
  await query(
    `INSERT INTO audit_log (actor, action, target_table, target_id, detail) VALUES ($1, $2, 'alumni', $3, $4::jsonb)`,
    [`account:${accountId}`, action, targetId, detail ? JSON.stringify(detail) : null],
  );
}

/* ---------------- FR-PROF-06: one click "still correct" ---------------- */

export async function confirmStillCorrectAction(): Promise<void> {
  const { acc, alumniId } = await alumniOf();
  await touchProfile(alumniId);
  await audit(acc.id, "profile.confirm", alumniId);
  revalidatePath("/me");
  redirect("/me?confirmed=1");
}

/* ---------------- FR-PROF-01/07: names ---------------- */

export async function saveProfileAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await alumniOf();
  const fe: Record<string, string> = {};
  const title = str(fd, "titleTh");
  const first = str(fd, "firstNameTh");
  const last = str(fd, "lastNameTh");
  const firstEn = str(fd, "firstNameEn");
  const lastEn = str(fd, "lastNameEn");
  const nickname = str(fd, "nickname");

  if (!title) fe.titleTh = "กรุณาระบุคำนำหน้า";
  if (!first || !THAI.test(first)) fe.firstNameTh = "กรุณากรอกชื่อเป็นอักษรไทย";
  if (!last || !THAI.test(last)) fe.lastNameTh = "กรุณากรอกนามสกุลเป็นอักษรไทย";
  if (firstEn && !LATIN.test(firstEn)) fe.firstNameEn = "ช่องนี้รับเฉพาะอักษรภาษาอังกฤษ";
  if (lastEn && !LATIN.test(lastEn)) fe.lastNameEn = "ช่องนี้รับเฉพาะอักษรภาษาอังกฤษ";
  if (nickname.length > 40) fe.nickname = "ยาวเกินไป";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  // A changed legal name keeps the previous one as a former name (DR-01).
  const [before] = await query<{ first_name_th: string; last_name_th: string }>(
    `SELECT first_name_th, last_name_th FROM alumni WHERE id = $1`,
    [alumniId],
  );
  await query(
    `UPDATE alumni SET title_th = $2, first_name_th = $3, last_name_th = $4,
            first_name_en = NULLIF($5, ''), last_name_en = NULLIF($6, ''), nickname = NULLIF($7, '')
     WHERE id = $1`,
    [alumniId, title, first, last, firstEn, lastEn, nickname],
  );
  if (before && (before.first_name_th !== first || before.last_name_th !== last)) {
    await query(
      `INSERT INTO alumni_former_name (alumni_id, first_name_th, last_name_th)
       SELECT $1, $2, $3 WHERE NOT EXISTS (
         SELECT 1 FROM alumni_former_name WHERE alumni_id = $1 AND first_name_th = $2 AND last_name_th = $3)`,
      [alumniId, before.first_name_th, before.last_name_th],
    );
  }
  await query(`UPDATE account SET display_name = $2 WHERE id = $1`, [acc.id, `${first} ${last}`]);
  await touchProfile(alumniId);
  await audit(acc.id, "profile.update", alumniId);
  revalidatePath("/me");
  return { ok: "บันทึกข้อมูลแล้ว" };
}

export async function addFormerNameAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { alumniId } = await alumniOf();
  const first = str(fd, "firstNameTh");
  const last = str(fd, "lastNameTh");
  if (!THAI.test(first) || !THAI.test(last)) {
    return { fieldErrors: { firstNameTh: "กรอกชื่อและนามสกุลเดิมเป็นอักษรไทย" } };
  }
  await query(
    `INSERT INTO alumni_former_name (alumni_id, first_name_th, last_name_th)
     SELECT $1, $2, $3 WHERE NOT EXISTS (
       SELECT 1 FROM alumni_former_name WHERE alumni_id = $1 AND first_name_th = $2 AND last_name_th = $3)`,
    [alumniId, first, last],
  );
  await touchProfile(alumniId);
  revalidatePath("/me/profile");
  return { ok: "เพิ่มชื่อเดิมแล้ว" };
}

export async function removeFormerNameAction(fd: FormData): Promise<void> {
  const { alumniId } = await alumniOf();
  await query(`DELETE FROM alumni_former_name WHERE id = $1 AND alumni_id = $2`, [Number(str(fd, "id")), alumniId]);
  revalidatePath("/me/profile");
  redirect("/me/profile");
}

/* ---------------- FR-PROF-10: photo ---------------- */

export async function uploadPhotoAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await alumniOf();
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { photo: "กรุณาเลือกรูป" } };
  try {
    const stored = await storeUpload(file, "profile_photo", { uploadedBy: `account:${acc.id}`, ownerAlumniId: alumniId });
    await query(`UPDATE alumni SET photo_file_id = $2 WHERE id = $1`, [alumniId, stored.id]);
  } catch (err) {
    if (err instanceof UploadError) return { fieldErrors: { photo: err.message } };
    throw err;
  }
  await touchProfile(alumniId);
  revalidatePath("/me");
  return { ok: "เปลี่ยนรูปโปรไฟล์แล้ว" };
}

export async function removePhotoAction(): Promise<void> {
  const { alumniId } = await alumniOf();
  await query(`UPDATE alumni SET photo_file_id = NULL WHERE id = $1`, [alumniId]);
  await recomputeCompleteness(alumniId);
  redirect("/me/profile");
}

/* ---------------- FR-PROF-02: employment history ---------------- */

const SECTORS = ["รัฐ", "รัฐวิสาหกิจ", "เอกชน", "ประกอบกิจการเอง", "อื่นๆ"];
const BANDS = ["ไม่เกิน 15,000", "15,001–20,000", "20,001–30,000", "30,001–40,000", "40,001–50,000", "มากกว่า 50,000"];

function monthOrNull(v: string): string | null {
  return /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : null;
}

export async function saveEmploymentAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await alumniOf();
  const id = Number(str(fd, "id")) || null;
  const organization = str(fd, "organization");
  const position = str(fd, "position");
  const jobCategory = str(fd, "jobCategory");
  const sector = str(fd, "sector");
  const salaryBand = str(fd, "salaryBand");
  const start = monthOrNull(str(fd, "start"));
  const end = monthOrNull(str(fd, "end"));
  const isCurrent = fd.get("isCurrent") === "on";
  const related = str(fd, "related");

  const fe: Record<string, string> = {};
  if (!organization) fe.organization = "กรุณากรอกชื่อหน่วยงาน";
  if (!position) fe.position = "กรุณากรอกตำแหน่ง";
  if (sector && !SECTORS.includes(sector)) fe.sector = "ประเภทหน่วยงานไม่ถูกต้อง";
  if (salaryBand && !BANDS.includes(salaryBand)) fe.salaryBand = "ช่วงรายได้ไม่ถูกต้อง";
  if (start && end && end < start) fe.end = "เดือนที่ออกต้องไม่ก่อนเดือนที่เริ่ม";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Only one current job at a time; the previous current one ends now.
    if (isCurrent) {
      await client.query(
        `UPDATE employment SET is_current = false, end_month = COALESCE(end_month, date_trunc('month', now())::date)
         WHERE alumni_id = $1 AND is_current AND ($2::int IS NULL OR id <> $2)`,
        [alumniId, id],
      );
    }
    const params = [alumniId, organization, position, jobCategory || null, sector || null, salaryBand || null, start, isCurrent ? null : end, isCurrent, related === "yes" ? true : related === "no" ? false : null];
    if (id) {
      await client.query(
        `UPDATE employment SET organization = $2, position = $3, job_category = $4, sector = $5::employment_sector,
                salary_band = $6, start_month = $7, end_month = $8, is_current = $9, is_related_to_major = $10
         WHERE id = $11 AND alumni_id = $1`,
        [...params, id],
      );
    } else {
      await client.query(
        `INSERT INTO employment (alumni_id, organization, position, job_category, sector, salary_band, start_month, end_month, is_current, is_related_to_major)
         VALUES ($1, $2, $3, $4, $5::employment_sector, $6, $7, $8, $9, $10)`,
        params,
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  await touchProfile(alumniId);
  await audit(acc.id, id ? "employment.update" : "employment.add", alumniId);
  revalidatePath("/me/career");
  return { ok: "บันทึกประวัติการทำงานแล้ว" };
}

export async function deleteEmploymentAction(fd: FormData): Promise<void> {
  const { alumniId } = await alumniOf();
  await query(`DELETE FROM employment WHERE id = $1 AND alumni_id = $2`, [Number(str(fd, "id")), alumniId]);
  await touchProfile(alumniId);
  redirect("/me/career");
}

export async function saveSkillsAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { alumniId } = await alumniOf();
  const names = [...new Set(str(fd, "skills").split(/[,\n]/).map((s) => s.trim()).filter(Boolean))];
  if (names.length > 20) return { fieldErrors: { skills: "ใส่ได้ไม่เกิน 20 ทักษะ" } };
  if (names.some((n) => n.length > 40)) return { fieldErrors: { skills: "ชื่อทักษะยาวเกิน 40 ตัวอักษร" } };

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM alumni_skill WHERE alumni_id = $1`, [alumniId]);
    for (const n of names) {
      // New skills become reference data that staff can rename or merge (FR-ADM-05).
      const [s] = (
        await client.query<{ id: number }>(
          `INSERT INTO skill (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [n],
        )
      ).rows;
      await client.query(`INSERT INTO alumni_skill (alumni_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [alumniId, s.id]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  await touchProfile(alumniId);
  revalidatePath("/me/career");
  return { ok: `บันทึก ${names.length} ทักษะแล้ว` };
}

/* ---------------- FR-PROF-03: contact + per-field visibility + consents ---------------- */

export async function savePrivacyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await alumniOf();
  const email = str(fd, "email");
  const phone = str(fd, "phone").replace(/[\s-]/g, "");
  const lineId = str(fd, "lineId");
  const province = str(fd, "province");
  const fe: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fe.email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (phone && !/^\d{9,10}$/.test(phone)) fe.phone = "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก";
  if (lineId.length > 60) fe.lineId = "ยาวเกินไป";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  const fieldVisibility: Record<string, string> = {};
  for (const f of VIS_FIELDS) {
    const v = str(fd, `vis_${f}`);
    fieldVisibility[f] = ["public", "members", "private"].includes(v) ? v : "members";
  }

  await query(
    `INSERT INTO alumni_contact (alumni_id, email, phone, line_id, province, visibility, field_visibility)
     VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), 'members', $6::jsonb)
     ON CONFLICT (alumni_id) DO UPDATE SET email = $2, phone = NULLIF($3, ''), line_id = NULLIF($4, ''),
       province = NULLIF($5, ''), field_visibility = $6::jsonb, updated_at = now()`,
    [alumniId, email, phone, lineId, province, JSON.stringify(fieldVisibility)],
  );

  // Consent changes are new rows, never edits (NFR-PDPA-01).
  const latest = await query<{ purpose: string; granted: boolean }>(
    `SELECT purpose::text, granted FROM alumni_latest_consent WHERE alumni_id = $1`,
    [alumniId],
  );
  const current = Object.fromEntries(latest.map((r) => [r.purpose, r.granted]));
  for (const [purpose, field] of [["directory_listing", "consentDirectory"], ["news", "consentNews"]] as const) {
    const wanted = fd.get(field) === "on";
    if (current[purpose] !== wanted) {
      await query(
        `INSERT INTO consent_log (alumni_id, purpose, granted, policy_version) VALUES ($1, $2::consent_purpose, $3, $4)`,
        [alumniId, purpose, wanted, process.env.POLICY_VERSION ?? "unversioned"],
      );
    }
  }
  await touchProfile(alumniId);
  await audit(acc.id, "privacy.update", alumniId, { fieldVisibility });
  revalidatePath("/me/privacy");
  return { ok: "บันทึกข้อมูลติดต่อและการตั้งค่าความเป็นส่วนตัวแล้ว" };
}

/* ---------------- FR-PROF-09 / FR-ADM-08: data-subject requests ---------------- */

const REQUEST_TYPES = ["access", "rectify", "delete", "withdraw", "object"];

export async function createPdpaRequestAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { acc, alumniId } = await alumniOf();
  const type = str(fd, "type");
  const detail = str(fd, "detail").slice(0, 2000);
  if (!REQUEST_TYPES.includes(type)) return { fieldErrors: { type: "กรุณาเลือกประเภทคำขอ" } };
  if ((type === "rectify" || type === "object") && !detail) {
    return { fieldErrors: { detail: "กรุณาระบุรายละเอียด" } };
  }
  const [open] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM pdpa_request WHERE alumni_id = $1 AND type = $2::pdpa_request_type AND status IN ('open', 'in_progress')`,
    [alumniId, type],
  );
  if (Number(open?.n) > 0) return { error: "คุณมีคำขอประเภทนี้ที่กำลังดำเนินการอยู่แล้ว" };

  await query(
    `INSERT INTO pdpa_request (alumni_id, account_id, type, detail) VALUES ($1, $2, $3::pdpa_request_type, $4)`,
    [alumniId, acc.id, type, detail || null],
  );
  // Withdrawing directory/news consent takes effect immediately; staff still
  // handle the request for anything that needs a human (e.g. deletion).
  if (type === "withdraw") {
    for (const purpose of ["directory_listing", "news"]) {
      await query(
        `INSERT INTO consent_log (alumni_id, purpose, granted, policy_version) VALUES ($1, $2::consent_purpose, false, $3)`,
        [alumniId, purpose, process.env.POLICY_VERSION ?? "unversioned"],
      );
    }
  }
  await audit(acc.id, "pdpa.request", alumniId, { type });
  revalidatePath("/me/data");
  return { ok: "ส่งคำขอแล้ว เจ้าหน้าที่จะดำเนินการภายใน 30 วันตามที่กฎหมายกำหนด และแจ้งผลทางอีเมล" };
}

/* ---------------- FR-NOTI-03: preferences ---------------- */

export async function savePrefsAction(_p: FormState, fd: FormData): Promise<FormState> {
  const acc = await requireMember();
  for (const { type } of NOTIF_TYPES) {
    const freq = str(fd, `freq_${type}`);
    await query(
      `INSERT INTO notification_pref (account_id, type, in_app, email, line, frequency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_id, type) DO UPDATE SET in_app = $3, email = $4, line = $5, frequency = $6`,
      [
        acc.id,
        type,
        fd.get(`in_app_${type}`) === "on",
        fd.get(`email_${type}`) === "on",
        fd.get(`line_${type}`) === "on",
        ["immediate", "weekly", "off"].includes(freq) ? freq : "immediate",
      ],
    );
  }
  revalidatePath("/me/notifications");
  return { ok: "บันทึกการตั้งค่าการแจ้งเตือนแล้ว" };
}

export async function markAllReadAction(): Promise<void> {
  const acc = await requireMember();
  await query(`UPDATE notification SET read_at = now() WHERE account_id = $1 AND channel = 'in_app' AND read_at IS NULL`, [acc.id]);
  revalidatePath("/", "layout");
  redirect("/me/notifications");
}

/* ---------------- settings ---------------- */

export async function changePasswordAction(_p: FormState, fd: FormData): Promise<FormState> {
  const acc = await requireMember();
  const current = typeof fd.get("current") === "string" ? (fd.get("current") as string) : "";
  const next = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  const problem = passwordProblem(next);
  if (problem) return { fieldErrors: { password: problem } };
  if (next !== fd.get("passwordConfirm")) return { fieldErrors: { passwordConfirm: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" } };
  const rows = await query<{ id: string }>(
    `UPDATE account SET password_hash = crypt($3, gen_salt('bf', 12))
     WHERE id = $1 AND (password_hash IS NULL OR password_hash = crypt($2, password_hash)) RETURNING id`,
    [acc.id, current, next],
  );
  if (!rows[0]) return { fieldErrors: { current: "รหัสผ่านปัจจุบันไม่ถูกต้อง" } };
  return { ok: "เปลี่ยนรหัสผ่านแล้ว" };
}

export async function unlinkLineAction(): Promise<void> {
  const acc = await requireMember();
  await query(`UPDATE account SET line_user_id = NULL WHERE id = $1`, [acc.id]);
  redirect("/me/settings?line=unlinked");
}

export async function logoutAction(): Promise<void> {
  await memberLogout();
  redirect("/");
}
