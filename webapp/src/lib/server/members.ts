import "server-only";
import { query } from "./db";
import { fileUrl } from "./files";

/**
 * Read side of the member back office (FR-ADM-18 … FR-ADM-21).
 * Callers must already have passed requireAdmin("admin").
 */

export type ClaimStatus = "unclaimed" | "pending" | "verified" | "rejected";

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  verified: "ยืนยันแล้ว",
  pending: "รอตรวจสอบ",
  unclaimed: "ยังไม่ Claim",
  rejected: "ไม่อนุมัติ",
};

export interface MemberStats {
  total: number;
  byStatus: Record<ClaimStatus, number>;
  /** verified members per degree level, in faculty order */
  byLevel: { level: string; verified: number; total: number }[];
  /** verified members per programme (top N), current names resolved */
  byProgram: { program: string; level: string; verified: number }[];
  /** verified members per admission decade, e.g. "2540–2549" */
  byCohortDecade: { decade: string; verified: number }[];
  freshVerified: number;
  directoryConsent: number;
  pendingRequests: number;
  newThisMonth: number;
}

const LEVEL_ORDER = ["ปวส.", "อส.บ.", "ทล.บ.", "วศ.บ.", "สถ.บ.", "วศ.ม."];

export async function getMemberStats(): Promise<MemberStats> {
  const [statusRows, levelRows, programRows, decadeRows, misc] = await Promise.all([
    query<{ claim_status: ClaimStatus; n: string }>(
      `SELECT claim_status::text AS claim_status, count(*) AS n FROM alumni GROUP BY 1`,
    ),
    query<{ level: string; verified: string; total: string }>(
      `SELECT p.degree_level::text AS level,
              count(*) FILTER (WHERE a.claim_status = 'verified') AS verified,
              count(*) AS total
       FROM alumni a JOIN program p ON p.id = a.program_id
       GROUP BY 1`,
    ),
    query<{ program: string; level: string; verified: string }>(
      `SELECT pr.current_name_th AS program, pr.degree_level::text AS level, count(*) AS verified
       FROM alumni a JOIN program_resolved pr ON pr.id = a.program_id
       WHERE a.claim_status = 'verified'
       GROUP BY 1, 2 ORDER BY 3 DESC, 1 LIMIT 10`,
    ),
    query<{ decade: number; verified: string }>(
      `SELECT (admission_year / 10) * 10 AS decade, count(*) AS verified
       FROM alumni WHERE claim_status = 'verified'
       GROUP BY 1 ORDER BY 1`,
    ),
    query<{ fresh: string; consent: string; pending_req: string; new_month: string }>(
      `SELECT
         (SELECT count(*) FROM alumni WHERE claim_status = 'verified'
            AND profile_updated_at > now() - interval '12 months') AS fresh,
         (SELECT count(DISTINCT alumni_id) FROM (
            SELECT DISTINCT ON (alumni_id) alumni_id, granted FROM consent_log
            WHERE purpose = 'directory_listing' AND alumni_id IS NOT NULL
            ORDER BY alumni_id, recorded_at DESC) latest WHERE granted) AS consent,
         (SELECT count(*) FROM registration_request WHERE status IN ('submitted', 'matched')) AS pending_req,
         (SELECT count(*) FROM registration_request
            WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')) AS new_month`,
    ),
  ]);

  const byStatus: Record<ClaimStatus, number> = { verified: 0, pending: 0, unclaimed: 0, rejected: 0 };
  for (const r of statusRows) byStatus[r.claim_status] = Number(r.n);

  return {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    byStatus,
    byLevel: levelRows
      .map((r) => ({ level: r.level, verified: Number(r.verified), total: Number(r.total) }))
      .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)),
    byProgram: programRows.map((r) => ({ program: r.program, level: r.level, verified: Number(r.verified) })),
    byCohortDecade: decadeRows.map((r) => ({
      decade: `${r.decade}–${r.decade + 9}`,
      verified: Number(r.verified),
    })),
    freshVerified: Number(misc[0]?.fresh ?? 0),
    directoryConsent: Number(misc[0]?.consent ?? 0),
    pendingRequests: Number(misc[0]?.pending_req ?? 0),
    newThisMonth: Number(misc[0]?.new_month ?? 0),
  };
}

/* ---------- list ---------- */

export interface MemberFilter {
  q?: string;
  status?: ClaimStatus | "";
  level?: string;
  page?: number;
}

export interface MemberRow {
  id: string;
  studentCode: string | null;
  name: string;
  nickname: string | null;
  level: string;
  program: string;
  programCurrent: string;
  admissionYear: number;
  graduationYear: number | null;
  status: ClaimStatus;
  email: string | null;
  province: string | null;
  profileUpdatedAt: Date;
}

export const PAGE_SIZE = 25;

export async function listMembers(f: MemberFilter): Promise<{ rows: MemberRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  const q = f.q?.trim();
  if (q) {
    params.push(`%${q}%`);
    const like = `$${params.length}`;
    // Former names count too: classmates often remember the old surname.
    where.push(`(
      a.first_name_th ILIKE ${like} OR a.last_name_th ILIKE ${like}
      OR (a.first_name_th || ' ' || a.last_name_th) ILIKE ${like}
      OR a.first_name_en ILIKE ${like} OR a.last_name_en ILIKE ${like}
      OR a.nickname ILIKE ${like} OR a.student_code ILIKE ${like}
      OR c.email ILIKE ${like}
      OR EXISTS (SELECT 1 FROM alumni_former_name f WHERE f.alumni_id = a.id
                 AND (f.first_name_th || ' ' || f.last_name_th) ILIKE ${like})
    )`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`a.claim_status = $${params.length}::claim_status`);
  }
  if (f.level) {
    params.push(f.level);
    where.push(`pr.degree_level = $${params.length}::degree_level`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, f.page ?? 1);

  const [countRow] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM alumni a
     JOIN program_resolved pr ON pr.id = a.program_id
     LEFT JOIN alumni_contact c ON c.alumni_id = a.id
     ${whereSql}`,
    params,
  );

  const rows = await query<{
    id: string; student_code: string | null; title_th: string; first_name_th: string; last_name_th: string;
    nickname: string | null; level: string; program: string; program_current: string;
    admission_year: number; graduation_year: number | null; status: ClaimStatus;
    email: string | null; province: string | null; profile_updated_at: Date;
  }>(
    `SELECT a.id, a.student_code, a.title_th, a.first_name_th, a.last_name_th, a.nickname,
            pr.degree_level::text AS level, pr.name_th AS program, pr.current_name_th AS program_current,
            a.admission_year, a.graduation_year, a.claim_status::text AS status,
            c.email, c.province, a.profile_updated_at
     FROM alumni a
     JOIN program_resolved pr ON pr.id = a.program_id
     LEFT JOIN alumni_contact c ON c.alumni_id = a.id
     ${whereSql}
     ORDER BY CASE a.claim_status WHEN 'pending' THEN 0 ELSE 1 END, a.admission_year DESC, a.first_name_th
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    params,
  );

  return {
    total: Number(countRow?.n ?? 0),
    rows: rows.map((r) => ({
      id: r.id,
      studentCode: r.student_code,
      name: `${r.title_th}${r.first_name_th} ${r.last_name_th}`,
      nickname: r.nickname,
      level: r.level,
      program: r.program,
      programCurrent: r.program_current,
      admissionYear: r.admission_year,
      graduationYear: r.graduation_year,
      status: r.status,
      email: r.email,
      province: r.province,
      profileUpdatedAt: r.profile_updated_at,
    })),
  };
}

/* ---------- detail ---------- */

export interface MemberDetail {
  id: string;
  studentCode: string | null;
  titleTh: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string | null;
  lastNameEn: string | null;
  nickname: string | null;
  birthDate: Date | null;
  level: string;
  program: string;
  programCurrent: string;
  programVerified: boolean;
  admissionYear: number;
  graduationYear: number | null;
  status: ClaimStatus;
  claimedAt: Date | null;
  profileUpdatedAt: Date;
  completeness: number;
  photoUrl: string | null;
  formerNames: string[];
  contact: { email: string | null; phone: string | null; lineId: string | null; province: string | null; visibility: string } | null;
  employment: { organization: string; position: string; sector: string | null; isCurrent: boolean; start: Date | null }[];
  skills: string[];
  consents: { purpose: string; granted: boolean; policyVersion: string; recordedAt: Date }[];
  requests: { id: string; path: string; status: string; note: string | null; createdAt: Date; reviewedAt: Date | null }[];
}

export async function getMember(id: string): Promise<MemberDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const [a] = await query<{
    id: string; student_code: string | null; title_th: string; first_name_th: string; last_name_th: string;
    first_name_en: string | null; last_name_en: string | null; nickname: string | null; birth_date: Date | null;
    level: string; program: string; program_current: string; program_verified: boolean;
    admission_year: number; graduation_year: number | null; status: ClaimStatus; claimed_at: Date | null;
    profile_updated_at: Date; completeness_score: number; photo_file_id: string | null;
  }>(
    `SELECT a.*, a.claim_status::text AS status, pr.degree_level::text AS level, pr.name_th AS program,
            pr.current_name_th AS program_current, pr.verified AS program_verified
     FROM alumni a JOIN program_resolved pr ON pr.id = a.program_id WHERE a.id = $1`,
    [id],
  );
  if (!a) return null;

  const [former, contact, employment, skills, consents, requests] = await Promise.all([
    query<{ n: string }>(
      `SELECT first_name_th || ' ' || last_name_th AS n FROM alumni_former_name WHERE alumni_id = $1 ORDER BY id`,
      [id],
    ),
    query<{ email: string | null; phone: string | null; line_id: string | null; province: string | null; visibility: string }>(
      `SELECT email, phone, line_id, province, visibility::text FROM alumni_contact WHERE alumni_id = $1`,
      [id],
    ),
    query<{ organization: string; position: string; sector: string | null; is_current: boolean; start_month: Date | null }>(
      `SELECT organization, position, sector::text, is_current, start_month FROM employment
       WHERE alumni_id = $1 ORDER BY is_current DESC, start_month DESC NULLS LAST`,
      [id],
    ),
    query<{ name: string }>(
      `SELECT s.name FROM alumni_skill x JOIN skill s ON s.id = x.skill_id WHERE x.alumni_id = $1 ORDER BY s.name`,
      [id],
    ),
    query<{ purpose: string; granted: boolean; policy_version: string; recorded_at: Date }>(
      `SELECT purpose::text, granted, policy_version, recorded_at FROM consent_log
       WHERE alumni_id = $1 ORDER BY recorded_at DESC, purpose`,
      [id],
    ),
    query<{ id: string; path: string; status: string; review_note: string | null; created_at: Date; reviewed_at: Date | null }>(
      `SELECT id, path::text, status::text, review_note, created_at, reviewed_at FROM registration_request
       WHERE alumni_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
  ]);

  return {
    id: a.id,
    studentCode: a.student_code,
    titleTh: a.title_th,
    firstNameTh: a.first_name_th,
    lastNameTh: a.last_name_th,
    firstNameEn: a.first_name_en,
    lastNameEn: a.last_name_en,
    nickname: a.nickname,
    birthDate: a.birth_date,
    level: a.level,
    program: a.program,
    programCurrent: a.program_current,
    programVerified: a.program_verified,
    admissionYear: a.admission_year,
    graduationYear: a.graduation_year,
    status: a.status,
    claimedAt: a.claimed_at,
    profileUpdatedAt: a.profile_updated_at,
    completeness: a.completeness_score,
    photoUrl: a.photo_file_id ? fileUrl(a.photo_file_id) : null,
    formerNames: former.map((f) => f.n),
    contact: contact[0]
      ? { email: contact[0].email, phone: contact[0].phone, lineId: contact[0].line_id, province: contact[0].province, visibility: contact[0].visibility }
      : null,
    employment: employment.map((e) => ({
      organization: e.organization, position: e.position, sector: e.sector, isCurrent: e.is_current, start: e.start_month,
    })),
    skills: skills.map((s) => s.name),
    consents: consents.map((c) => ({ purpose: c.purpose, granted: c.granted, policyVersion: c.policy_version, recordedAt: c.recorded_at })),
    requests: requests.map((r) => ({
      id: r.id, path: r.path, status: r.status, note: r.review_note, createdAt: r.created_at, reviewedAt: r.reviewed_at,
    })),
  };
}

/** Thai date-time for admin tables, Bangkok time, Buddhist year. */
export function thaiDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function thaiDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}
