import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/server/db";
import { clientIpFrom } from "@/lib/server/client-ip";
import { hit, isLimited, recordHit, LIMITS } from "@/lib/server/rate-limit";
import { emailTaken, startMemberSession } from "@/lib/server/member-auth";
import {
  emptyForm,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  type RegistrationForm,
} from "@/lib/registration";

export const dynamic = "force-dynamic";

/** What the browser sends: the form minus the File, plus the uploaded photo's row id. */
type RegistrationPayload = Omit<RegistrationForm, "photo"> & { photoFileId?: string | null };

const TOO_MANY = "มีการยืนยันตัวตนด้วยรหัสนักศึกษานี้ผิดหลายครั้งเกินไป กรุณารอ 1 ชั่วโมง หรือติดต่องานศิษย์เก่าสัมพันธ์";

/**
 * POST /api/register
 *
 * One transaction writes: the registration request, one consent row per
 * purpose (FR-AUTH-05), the member account (FR-AUTH-04), and either
 *   claim + match → the imported record moves to 'pending' (FR-AUTH-01)
 *   otherwise     → a new 'pending' alumni row for staff review (FR-AUTH-02)
 *
 * FR-AUTH-06: wrong identity proof is limited per student code, and the
 * response never says whether the proof matched. Without both, the form
 * would let anyone try birth dates against a known student code until one
 * "works". A failed claim still becomes an ordinary application, so a real
 * alumnus who mistyped is not stuck — staff resolve it by hand.
 */
export async function POST(req: Request) {
  let body: RegistrationPayload;
  try {
    body = (await req.json()) as RegistrationPayload;
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const form: RegistrationForm = { ...emptyForm(), ...body, photo: null };
  const errors = { ...validateStep1(form), ...validateStep2(form), ...validateStep3(form), ...validateStep4(form) };
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน", fields: errors }, { status: 422 });
  }

  const ip = clientIpFrom(req.headers);
  const userAgent = req.headers.get("user-agent");
  const studentCode = form.studentCode.trim();

  // ---- throttles (FR-AUTH-06) ----
  if (await hit(LIMITS.registrationGlobal, ip ?? "all")) {
    return NextResponse.json({ error: "มีผู้สมัครจำนวนมากในขณะนี้ กรุณาลองใหม่ภายหลัง" }, { status: 429 });
  }
  if (form.path === "claim" && studentCode) {
    if (await isLimited(LIMITS.claimFailure, studentCode)) {
      return NextResponse.json({ error: TOO_MANY }, { status: 429 });
    }
    if (await hit(LIMITS.registrationPerCode, studentCode)) {
      return NextResponse.json({ error: TOO_MANY }, { status: 429 });
    }
  }

  if (await emailTaken(form.email)) {
    return NextResponse.json(
      { error: "อีเมลนี้มีบัญชีอยู่แล้ว", fields: { email: "อีเมลนี้มีบัญชีอยู่แล้ว — เข้าสู่ระบบหรือใช้ “ลืมรหัสผ่าน”" } },
      { status: 409 },
    );
  }

  const photoFileId =
    typeof body.photoFileId === "string" && body.photoFileId.trim() ? body.photoFileId.trim() : null;
  const policyVersion = process.env.POLICY_VERSION ?? "unversioned";
  const client = await getPool().connect();
  let accountId: string;
  let claimFailed = false;

  try {
    await client.query("BEGIN");

    // Never persist the identity proof or the password in the raw payload.
    const { idLast4, birthDate, password, passwordConfirm, ...safePayload } = body;
    void passwordConfirm;

    const [program] = (
      await client.query<{ id: number }>("SELECT id FROM program WHERE code = $1", [form.programId])
    ).rows;
    if (!program) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "ไม่พบสาขาวิชาที่เลือก", fields: { programId: "สาขาวิชาไม่ถูกต้อง" } }, { status: 422 });
    }

    const [reg] = (
      await client.query<{ id: string }>(
        `INSERT INTO registration_request (path, payload, photo_file_id)
         VALUES ($1::registration_path, $2::jsonb, $3) RETURNING id`,
        [form.path, JSON.stringify(safePayload), photoFileId],
      )
    ).rows;

    for (const [purpose, granted] of [
      ["data_processing", form.consentData],
      ["directory_listing", form.consentDirectory],
      ["news", form.consentNews],
    ] as const) {
      await client.query(
        `INSERT INTO consent_log (registration_id, purpose, granted, policy_version, ip_address, user_agent)
         VALUES ($1, $2::consent_purpose, $3, $4, $5, $6)`,
        [reg.id, purpose, granted, policyVersion, ip, userAgent],
      );
    }

    let alumniId: string | null = null;
    let status: "submitted" | "matched" = "submitted";
    let note: string | null = null;

    if (form.path === "claim") {
      const [record] = (
        await client.query<{ id: string; claim_status: string; ok: boolean }>(
          // Two parameters, not one: PostgreSQL infers a single parameter's
          // type from its first use, so sharing $2 between ::date and crypt()
          // makes crypt(date, text) fail.
          `SELECT a.id, a.claim_status::text,
                  CASE WHEN $2::date IS NOT NULL THEN a.birth_date = $2::date
                       ELSE a.id_last4_hash IS NOT NULL AND a.id_last4_hash = crypt($3::text, a.id_last4_hash) END AS ok
           FROM alumni a WHERE a.student_code = $1 FOR UPDATE`,
          [
            studentCode,
            form.verifyMethod === "birthdate" ? birthDate : null,
            form.verifyMethod === "idLast4" ? idLast4 : null,
          ],
        )
      ).rows;

      if (record?.ok && record.claim_status === "unclaimed") {
        alumniId = record.id;
        status = "matched";
        await client.query(
          `UPDATE alumni SET claim_status = 'pending', photo_file_id = COALESCE($2, photo_file_id) WHERE id = $1`,
          [alumniId, photoFileId],
        );
        await upsertContact(client, alumniId, form);
      } else if (record?.ok) {
        // The genuine owner's proof, but the record is already claimed or
        // pending — someone else may have it. Never merge silently.
        note = `ข้อมูลยืนยันตรงกับระเบียน แต่ระเบียนมีสถานะ ${record.claim_status} อยู่แล้ว — ต้องตรวจสอบ`;
      } else {
        claimFailed = Boolean(record); // only a real code counts against the limit
        note = record
          ? "ข้อมูลยืนยันไม่ตรงกับระเบียนของรหัสนักศึกษานี้ — ต้องตรวจสอบด้วยเจ้าหน้าที่"
          : "ไม่พบรหัสนักศึกษานี้ในข้อมูลที่นำเข้า — ต้องตรวจสอบด้วยเจ้าหน้าที่";
      }
    }

    if (!alumniId) {
      // New applicant, or a claim that did not match: create a pending row.
      // The student code is kept only when no other record uses it.
      const [{ taken }] = (
        await client.query<{ taken: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM alumni WHERE student_code = $1) AS taken`,
          [studentCode || null],
        )
      ).rows;
      const title = form.titleTh === "อื่น ๆ" ? form.titleThOther.trim() : form.titleTh;
      const [created] = (
        await client.query<{ id: string }>(
          `INSERT INTO alumni
             (student_code, title_th, first_name_th, last_name_th, first_name_en, last_name_en,
              nickname, program_id, admission_year, graduation_year, claim_status, photo_file_id, completeness_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12)
           RETURNING id`,
          [
            studentCode && !taken ? studentCode : null,
            title,
            form.firstNameTh.trim(),
            form.lastNameTh.trim(),
            form.firstNameEn.trim() || null,
            form.lastNameEn.trim() || null,
            form.nickname.trim() || null,
            program.id,
            Number(form.admissionYear),
            Number(form.graduationYear),
            photoFileId,
            completeness(form),
          ],
        )
      ).rows;
      alumniId = created.id;
      await upsertContact(client, alumniId, form);
    }

    for (const n of form.formerNames) {
      if (!n.firstNameTh.trim()) continue;
      await client.query(
        `INSERT INTO alumni_former_name (alumni_id, first_name_th, last_name_th)
         SELECT $1, $2, $3 WHERE NOT EXISTS (
           SELECT 1 FROM alumni_former_name WHERE alumni_id = $1 AND first_name_th = $2 AND last_name_th = $3)`,
        [alumniId, n.firstNameTh.trim(), n.lastNameTh.trim()],
      );
    }

    const displayName = `${form.firstNameTh.trim()} ${form.lastNameTh.trim()}`;
    const [acc] = (
      await client.query<{ id: string }>(
        `INSERT INTO account (email, password_hash, role, alumni_id, student_code, display_name)
         VALUES ($1, crypt($2, gen_salt('bf', 12)), 'alumni', $3, $4, $5) RETURNING id`,
        [form.email.trim(), password, alumniId, studentCode || null, displayName],
      )
    ).rows;
    accountId = acc.id;

    await client.query(`UPDATE consent_log SET alumni_id = $1 WHERE registration_id = $2`, [alumniId, reg.id]);
    if (photoFileId) {
      await client.query(`UPDATE file_object SET owner_alumni_id = $1 WHERE id = $2`, [alumniId, photoFileId]);
    }
    await client.query(
      `UPDATE registration_request
       SET status = $2::registration_status, alumni_id = $3, review_note = $4, account_id = $5
       WHERE id = $1`,
      [reg.id, status, alumniId, note, accountId],
    );
    await client.query(
      `INSERT INTO audit_log (actor, action, target_table, target_id, detail, ip_address)
       VALUES ('anonymous', 'registration.submit', 'registration_request', $1, $2::jsonb, $3)`,
      [reg.id, JSON.stringify({ path: form.path, status, matched: status === "matched", claimFailed }), ip],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[api/register]", err);
    return NextResponse.json({ error: "บันทึกใบสมัครไม่สำเร็จ" }, { status: 503 });
  } finally {
    client.release();
  }

  // Outside the transaction: a failure here must not undo the application.
  if (claimFailed) await recordHit(LIMITS.claimFailure, studentCode);
  await startMemberSession(accountId);

  // Deliberately the same answer whether or not the claim matched.
  return NextResponse.json({ status: "submitted" }, { status: 201 });
}

async function upsertContact(client: PoolClient, alumniId: string, form: RegistrationForm): Promise<void> {
  await client.query(
    `INSERT INTO alumni_contact (alumni_id, email, phone, line_id, province, visibility)
     VALUES ($1, $2, $3, $4, $5, $6::visibility)
     ON CONFLICT (alumni_id) DO UPDATE SET
       email = EXCLUDED.email,
       phone = COALESCE(EXCLUDED.phone, alumni_contact.phone),
       line_id = COALESCE(EXCLUDED.line_id, alumni_contact.line_id),
       province = COALESCE(EXCLUDED.province, alumni_contact.province),
       visibility = EXCLUDED.visibility, updated_at = now()`,
    [alumniId, form.email.trim(), form.phone.trim() || null, form.lineId.trim() || null, form.province.trim() || null, form.visibility],
  );
}

/** FR-PROF-05 — rough completeness for a freshly created row; recomputed on every profile save. */
function completeness(f: RegistrationForm): number {
  const checks = [f.firstNameEn.trim(), f.lastNameEn.trim(), f.nickname.trim(), f.phone.trim(), f.lineId.trim(), f.province.trim()];
  return Math.min(100, 40 + checks.filter(Boolean).length * 10);
}
