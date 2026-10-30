import "server-only";
import { query } from "./db";
import { isMember, type Viewer } from "./member-auth";

/**
 * Profile data shared by /me (owner) and the directory (others).
 * Visibility rules for FR-PROF-03 live here and nowhere else.
 */

export type Visibility = "public" | "members" | "private";
export const VIS_FIELDS = ["email", "phone", "line", "province", "workplace", "photo"] as const;
export type VisField = (typeof VIS_FIELDS)[number];

export const VIS_FIELD_LABEL: Record<VisField, string> = {
  email: "อีเมล",
  phone: "เบอร์โทรศัพท์",
  line: "LINE ID",
  province: "จังหวัด",
  workplace: "ที่ทำงานและตำแหน่ง",
  photo: "รูปโปรไฟล์",
};

export function fieldVisibility(fieldVis: Record<string, string> | null, fallback: Visibility, f: VisField): Visibility {
  const v = fieldVis?.[f];
  return v === "public" || v === "members" || v === "private" ? v : fallback;
}

/** Can this viewer see this field of someone else's profile? Private = staff in the back office only. */
export function canSee(vis: Visibility, viewer: Viewer): boolean {
  if (vis === "public") return true;
  if (vis === "members") return isMember(viewer);
  return false;
}

/** FR-PROF-05 — weighted so the fields that make someone findable count most. */
export async function recomputeCompleteness(alumniId: string): Promise<number> {
  const [r] = await query<{ score: number }>(
    `SELECT (
        20                                                       -- name, programme, cohort (always present)
      + CASE WHEN a.photo_file_id IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN a.nickname IS NOT NULL AND a.nickname <> '' THEN 5 ELSE 0 END
      + CASE WHEN a.first_name_en IS NOT NULL AND a.first_name_en <> '' THEN 5 ELSE 0 END
      + CASE WHEN c.email IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN c.phone IS NOT NULL OR c.line_id IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN c.province IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN EXISTS (SELECT 1 FROM employment e WHERE e.alumni_id = a.id AND e.is_current) THEN 20 ELSE 0 END
      + CASE WHEN EXISTS (SELECT 1 FROM alumni_skill s WHERE s.alumni_id = a.id) THEN 10 ELSE 0 END
     )::int AS score
     FROM alumni a LEFT JOIN alumni_contact c ON c.alumni_id = a.id WHERE a.id = $1`,
    [alumniId],
  );
  const score = Math.min(100, r?.score ?? 0);
  await query(`UPDATE alumni SET completeness_score = $2 WHERE id = $1`, [alumniId, score]);
  return score;
}

/** What is still missing, for the nudges on /me (FR-PROF-05). */
export async function missingItems(alumniId: string): Promise<{ label: string; href: string }[]> {
  const [r] = await query<{
    photo: boolean; nickname: boolean; en: boolean; email: boolean; reach: boolean; province: boolean; job: boolean; skills: boolean;
  }>(
    `SELECT a.photo_file_id IS NOT NULL AS photo,
            coalesce(a.nickname, '') <> '' AS nickname,
            coalesce(a.first_name_en, '') <> '' AS en,
            c.email IS NOT NULL AS email,
            (c.phone IS NOT NULL OR c.line_id IS NOT NULL) AS reach,
            c.province IS NOT NULL AS province,
            EXISTS (SELECT 1 FROM employment e WHERE e.alumni_id = a.id AND e.is_current) AS job,
            EXISTS (SELECT 1 FROM alumni_skill s WHERE s.alumni_id = a.id) AS skills
     FROM alumni a LEFT JOIN alumni_contact c ON c.alumni_id = a.id WHERE a.id = $1`,
    [alumniId],
  );
  if (!r) return [];
  const out: { label: string; href: string }[] = [];
  if (!r.job) out.push({ label: "เพิ่มงานปัจจุบัน", href: "/me/career" });
  if (!r.photo) out.push({ label: "ใส่รูปโปรไฟล์", href: "/me/profile" });
  if (!r.province) out.push({ label: "ระบุจังหวัดที่อยู่", href: "/me/privacy" });
  if (!r.reach) out.push({ label: "เพิ่มเบอร์โทรหรือ LINE", href: "/me/privacy" });
  if (!r.skills) out.push({ label: "เพิ่มทักษะวิชาชีพ", href: "/me/career" });
  if (!r.nickname) out.push({ label: "ใส่ชื่อเล่น", href: "/me/profile" });
  if (!r.en) out.push({ label: "ใส่ชื่อภาษาอังกฤษ", href: "/me/profile" });
  return out;
}

/** FR-PROF-04/06 — any owner edit, or a one-click "still correct", refreshes freshness. */
export async function touchProfile(alumniId: string): Promise<void> {
  await query(`UPDATE alumni SET profile_updated_at = now() WHERE id = $1`, [alumniId]);
  await recomputeCompleteness(alumniId);
}

/** FR-PROF-08 — everything the system holds about one alumnus, for the owner's own download. */
export async function exportPersonalData(alumniId: string, accountId: string): Promise<Record<string, unknown>> {
  const one = async (sql: string) => (await query(sql, [alumniId]))[0] ?? null;
  const many = (sql: string, p: unknown[] = [alumniId]) => query(sql, p);
  return {
    exported_at: new Date().toISOString(),
    note: "ข้อมูลส่วนบุคคลของคุณที่จัดเก็บในระบบศิษย์เก่า คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยกาฬสินธุ์",
    profile: await one(
      `SELECT a.student_code, a.title_th, a.first_name_th, a.last_name_th, a.first_name_en, a.last_name_en, a.nickname,
              a.birth_date, p.name_th AS program, p.degree_level, a.admission_year, a.graduation_year, a.claim_status,
              a.profile_updated_at, a.created_at
       FROM alumni a JOIN program p ON p.id = a.program_id WHERE a.id = $1`,
    ),
    former_names: await many(`SELECT first_name_th, last_name_th FROM alumni_former_name WHERE alumni_id = $1`),
    contact: await one(`SELECT email, phone, line_id, province, country, visibility, field_visibility FROM alumni_contact WHERE alumni_id = $1`),
    employment: await many(
      `SELECT organization, position, job_category, sector, salary_band, start_month, end_month, is_current FROM employment WHERE alumni_id = $1`,
    ),
    skills: (await many(`SELECT s.name FROM alumni_skill x JOIN skill s ON s.id = x.skill_id WHERE x.alumni_id = $1`)).map((r) => (r as { name: string }).name),
    consents: await many(`SELECT purpose, granted, policy_version, recorded_at FROM consent_log WHERE alumni_id = $1 ORDER BY recorded_at`),
    registrations: await many(`SELECT path, status, payload, created_at, reviewed_at FROM registration_request WHERE alumni_id = $1`),
    posts: await many(`SELECT type, title, body, visibility, moderation_status, published_at FROM alumni_post WHERE author_id = $1`),
    comments: await many(`SELECT c.body, c.created_at FROM alumni_post_comment c WHERE c.account_id = $1`, [accountId]),
    event_registrations: await many(
      `SELECT e.title, r.registered_at, r.cancelled_at FROM event_registration r JOIN event e ON e.id = r.event_id WHERE r.alumni_id = $1`,
    ),
    survey_responses: await many(`SELECT s.title, r.answers, r.submitted_at FROM survey_response r JOIN survey s ON s.id = r.survey_id WHERE r.alumni_id = $1`),
    pdpa_requests: await many(`SELECT type, detail, status, response, created_at, handled_at FROM pdpa_request WHERE alumni_id = $1`),
    account: (await query(`SELECT email, role, created_at, last_login_at, line_user_id IS NOT NULL AS line_linked FROM account WHERE id = $1`, [accountId]))[0],
  };
}
