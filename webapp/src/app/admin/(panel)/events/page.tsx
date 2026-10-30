import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDateTime } from "@/lib/server/members";

export const metadata = { title: "กิจกรรม" };

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requireAdmin(["admin", "editor"]);
  const { deleted } = await searchParams;
  const rows = await query<{
    id: number; title: string; starts_at: Date; venue: string | null; is_published: boolean; registration_open: boolean;
    capacity: number | null; registered: string; orders: string; upcoming: boolean;
  }>(
    `SELECT e.id, e.title, e.starts_at, e.venue, e.is_published, e.registration_open, e.capacity,
            coalesce(e.ends_at, e.starts_at) >= now() AS upcoming,
            (SELECT count(*) FROM event_registration r WHERE r.event_id = e.id AND r.cancelled_at IS NULL) AS registered,
            (SELECT count(*) FROM event_order o JOIN event_item i ON i.id = o.item_id WHERE i.event_id = e.id AND o.status <> 'cancelled') AS orders
     FROM event e ORDER BY upcoming DESC, CASE WHEN coalesce(e.ends_at, e.starts_at) >= now() THEN e.starts_at END ASC, e.starts_at DESC`,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>กิจกรรม</h1>
          <p>สร้างกิจกรรม เปิดรับลงทะเบียน ดูรายชื่อผู้เข้าร่วม และจัดการของที่ระลึก</p>
        </div>
        <Link href="/admin/events/new" className="btn btn-primary">+ สร้างกิจกรรม</Link>
      </div>
      {deleted ? <p className="flash flash-ok" role="status">ลบกิจกรรมแล้ว</p> : null}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">กิจกรรม</th><th scope="col">วันเวลา</th><th scope="col">สถานะ</th><th scope="col" className="num">ลงทะเบียน</th><th scope="col" className="num">จองของ</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 32 }}>ยังไม่มีกิจกรรม</td></tr>
            ) : rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/admin/events/${e.id}`}><strong>{e.title}</strong></Link>
                  <div className="small muted">{e.venue ?? "—"}</div>
                </td>
                <td className="small">{thaiDateTime(e.starts_at)}</td>
                <td>
                  <span className={`pill pill-${!e.is_published ? "draft" : e.upcoming ? "published" : "unclaimed"}`}>
                    {!e.is_published ? "ฉบับร่าง" : e.upcoming ? "เผยแพร่" : "ผ่านไปแล้ว"}
                  </span>
                  {e.registration_open && e.upcoming ? <div className="small muted">เปิดลงทะเบียน</div> : null}
                </td>
                <td className="num">{e.registered}{e.capacity !== null ? ` / ${e.capacity}` : ""}</td>
                <td className="num">{e.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
