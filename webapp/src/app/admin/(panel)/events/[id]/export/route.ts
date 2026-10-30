import { audit, getAdminSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { toCsv } from "@/lib/server/csv";

export const dynamic = "force-dynamic";

/** GET /admin/events/:id/export — FR-EVT-04 attendee list as CSV (admin, editor). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session || (session.role !== "admin" && session.role !== "editor")) return new Response("Not found", { status: 404 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const [event] = await query<{ title: string }>(`SELECT title FROM event WHERE id = $1`, [id]);
  if (!event) return new Response("Not found", { status: 404 });
  const rows = await query<Record<string, unknown>>(
    `SELECT a.title_th, a.first_name_th, a.last_name_th, a.nickname, a.admission_year, pr.degree_level::text AS level,
            pr.name_th AS program, c.email, c.phone,
            to_char(r.registered_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') AS registered_at
     FROM event_registration r JOIN alumni a ON a.id = r.alumni_id JOIN program_resolved pr ON pr.id = a.program_id
     LEFT JOIN alumni_contact c ON c.alumni_id = a.id
     WHERE r.event_id = $1 AND r.cancelled_at IS NULL ORDER BY r.registered_at`,
    [id],
  );
  await audit(session, "event.export", "event", id, { rows: rows.length });

  const csv = toCsv(
    [
      ["คำนำหน้า", "title_th"], ["ชื่อ", "first_name_th"], ["นามสกุล", "last_name_th"], ["ชื่อเล่น", "nickname"],
      ["รุ่น", "admission_year"], ["ระดับ", "level"], ["สาขา", "program"], ["อีเมล", "email"], ["โทรศัพท์", "phone"],
      ["ลงทะเบียนเมื่อ", "registered_at"],
    ],
    rows,
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-${id}-attendees.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
