import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { clientIpFrom } from "@/lib/server/client-ip";
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

function clientMeta(req: Request) {
  // Null unless TRUST_PROXY=true — see src/lib/server/client-ip.ts.
  return { ip: clientIpFrom(req.headers), userAgent: req.headers.get("user-agent") };
}

/**
 * POST /api/register
 *
 * Writes one registration_request plus a consent_log row per purpose
 * (FR-AUTH-05 / NFR-PDPA-01), then:
 *   claim → tries to match an unclaimed alumni row by student code and the
 *           corroborating field (FR-AUTH-01);
 *   new   → creates a pending alumni row for staff review (FR-AUTH-02).
 * Everything runs in one transaction so a half-written application cannot exist.
 */
export async function POST(req: Request) {
  let body: RegistrationPayload;
  try {
    body = (await req.json()) as RegistrationPayload;
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  // Server-side validation reuses the exact client rules.
  const form: RegistrationForm = { ...emptyForm(), ...body, photo: null };
  const errors = {
    ...validateStep1(form),
    ...validateStep2(form),
    ...validateStep3(form),
    ...validateStep4(form),
  };
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน", fields: errors }, { status: 422 });
  }

  // Treat "", undefined and null alike: no photo. An empty string would
  // otherwise reach a uuid column and abort the whole transaction.
  const photoFileId =
    typeof body.photoFileId === "string" && body.photoFileId.trim() ? body.photoFileId.trim() : null;

  const { ip, userAgent } = clientMeta(req);
  const policyVersion = process.env.POLICY_VERSION ?? "unversioned";
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    // Never persist the corroborating secret in the raw payload.
    const { idLast4, birthDate, ...safePayload } = body;

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
         VALUES ($1::registration_path, $2::jsonb, $3)
         RETURNING id`,
        [form.path, JSON.stringify(safePayload), photoFileId],
      )
    ).rows;

    const consents: [string, boolean][] = [
      ["data_processing", form.consentData],
      ["directory_listing", form.consentDirectory],
      ["news", form.consentNews],
    ];
    for (const [purpose, granted] of consents) {
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
      // Match on the student code, then corroborate with whichever field the
      // applicant chose. The id digits are compared against a bcrypt hash.
      const corroborate =
        form.verifyMethod === "birthdate"
          ? "a.birth_date = $2::date"
          : "a.id_last4_hash IS NOT NULL AND a.id_last4_hash = crypt($2, a.id_last4_hash)";
      const secret = form.verifyMethod === "birthdate" ? birthDate : idLast4;

      const [match] = (
        await client.query<{ id: string; claim_status: string }>(
          `SELECT a.id, a.claim_status::text FROM alumni a
           WHERE a.student_code = $1 AND ${corroborate}`,
          [form.studentCode.trim(), secret],
        )
      ).rows;

      if (match && match.claim_status === "unclaimed") {
        alumniId = match.id;
        status = "matched";
        await client.query(
          `UPDATE alumni SET claim_status = 'pending', photo_file_id = COALESCE($2, photo_file_id)
           WHERE id = $1`,
          [alumniId, photoFileId],
        );
      } else if (match) {
        note = `ระเบียนนี้มีสถานะ ${match.claim_status} อยู่แล้ว`;
      } else {
        note = "ไม่พบระเบียนที่ตรงกับรหัสนักศึกษาและข้อมูลยืนยัน";
      }
    } else {
      const title = form.titleTh === "อื่น ๆ" ? form.titleThOther.trim() : form.titleTh;
      const [created] = (
        await client.query<{ id: string }>(
          `INSERT INTO alumni
             (student_code, title_th, first_name_th, last_name_th, first_name_en, last_name_en,
              nickname, program_id, admission_year, graduation_year, claim_status, photo_file_id,
              completeness_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12)
           RETURNING id`,
          [
            form.studentCode.trim() || null,
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

      for (const n of form.formerNames) {
        if (!n.firstNameTh.trim()) continue;
        await client.query(
          `INSERT INTO alumni_former_name (alumni_id, first_name_th, last_name_th) VALUES ($1, $2, $3)`,
          [alumniId, n.firstNameTh.trim(), n.lastNameTh.trim()],
        );
      }
      await client.query(
        `INSERT INTO alumni_contact (alumni_id, email, phone, line_id, province, visibility)
         VALUES ($1, $2, $3, $4, $5, $6::visibility)`,
        [
          alumniId,
          form.email.trim(),
          form.phone.trim() || null,
          form.lineId.trim() || null,
          form.province.trim() || null,
          form.visibility,
        ],
      );
    }

    if (alumniId) {
      await client.query(`UPDATE consent_log SET alumni_id = $1 WHERE registration_id = $2`, [alumniId, reg.id]);
      if (photoFileId) {
        await client.query(`UPDATE file_object SET owner_alumni_id = $1 WHERE id = $2`, [alumniId, photoFileId]);
      }
    }

    await client.query(
      `UPDATE registration_request SET status = $2::registration_status, alumni_id = $3, review_note = $4
       WHERE id = $1`,
      [reg.id, status, alumniId, note],
    );

    await client.query(
      `INSERT INTO audit_log (actor, action, target_table, target_id, detail, ip_address)
       VALUES ('anonymous', 'registration.submit', 'registration_request', $1, $2::jsonb, $3)`,
      [reg.id, JSON.stringify({ path: form.path, status, matched: status === "matched" }), ip],
    );

    await client.query("COMMIT");
    // `matched` means "an imported registrar record was found". A brand-new
    // application also gets an alumni row, but that is not a match.
    return NextResponse.json({ id: reg.id, status, matched: status === "matched" }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[api/register]", err);
    return NextResponse.json({ error: "บันทึกใบสมัครไม่สำเร็จ" }, { status: 503 });
  } finally {
    client.release();
  }
}

/** FR-PROF-05 — a rough completeness score for a freshly created row. */
function completeness(f: RegistrationForm): number {
  const checks = [
    f.firstNameEn.trim(), f.lastNameEn.trim(), f.nickname.trim(),
    f.phone.trim(), f.lineId.trim(), f.province.trim(),
  ];
  const filled = checks.filter(Boolean).length;
  // Required fields count for 40; each optional one adds 10.
  return Math.min(100, 40 + filled * 10);
}
