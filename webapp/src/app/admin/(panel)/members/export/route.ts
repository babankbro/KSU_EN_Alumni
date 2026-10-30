import { getAdminSession, audit } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { toCsv } from "@/lib/server/csv";
import type { ClaimStatus } from "@/lib/server/members";

export const dynamic = "force-dynamic";

const STATUSES: ClaimStatus[] = ["pending", "verified", "unclaimed", "rejected"];

/**
 * GET /admin/members/export — FR-DIR-11: the member list as CSV, using the
 * same filters as the members page. Staff with the admin or faculty role
 * only; every export is written to the audit log with its filters and size.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || (session.role !== "admin" && session.role !== "faculty")) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const level = url.searchParams.get("level") ?? "";
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);

  const where: string[] = ["a.anonymized_at IS NULL"];
  const params: unknown[] = [];
  if (STATUSES.includes(status as ClaimStatus)) {
    params.push(status);
    where.push(`a.claim_status = $${params.length}::claim_status`);
  }
  if (level) {
    params.push(level);
    where.push(`pr.degree_level::text = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`((a.first_name_th || ' ' || a.last_name_th) ILIKE $${params.length} OR a.student_code ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
  }

  const rows = await query<Record<string, unknown>>(
    `SELECT a.student_code, a.title_th, a.first_name_th, a.last_name_th, a.nickname,
            pr.degree_level::text AS degree_level, pr.name_th AS program, pr.current_name_th AS program_current,
            a.admission_year, a.graduation_year, a.claim_status::text AS status,
            c.email, c.phone, c.province, e.organization, e.position,
            to_char(a.profile_updated_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS profile_updated
     FROM alumni a
     JOIN program_resolved pr ON pr.id = a.program_id
     LEFT JOIN alumni_contact c ON c.alumni_id = a.id
     LEFT JOIN LATERAL (SELECT organization, position FROM employment WHERE alumni_id = a.id AND is_current LIMIT 1) e ON true
     WHERE ${where.join(" AND ")}
     ORDER BY a.admission_year DESC, a.first_name_th`,
    params,
  );

  await audit(session, "member.export", "alumni", "csv", { status, level, q, rows: rows.length });

  const csv = toCsv(
    [
      ["รหัสนักศึกษา", "student_code"], ["คำนำหน้า", "title_th"], ["ชื่อ", "first_name_th"], ["นามสกุล", "last_name_th"],
      ["ชื่อเล่น", "nickname"], ["ระดับ", "degree_level"], ["สาขา (ตามที่เรียน)", "program"], ["สาขา (ปัจจุบัน)", "program_current"],
      ["ปีที่เข้า", "admission_year"], ["ปีที่จบ", "graduation_year"], ["สถานะ", "status"], ["อีเมล", "email"], ["โทรศัพท์", "phone"],
      ["จังหวัด", "province"], ["ที่ทำงาน", "organization"], ["ตำแหน่ง", "position"], ["อัปเดตล่าสุด", "profile_updated"],
    ],
    rows,
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alumni-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
