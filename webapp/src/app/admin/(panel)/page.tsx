import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { getMemberStats, thaiDateTime } from "@/lib/server/members";
import { formatNumber } from "@/lib/format";
import CountBars from "@/components/admin/CountBars";

export const metadata = { title: "ภาพรวม" };

const ACTION_LABEL: Record<string, string> = {
  "registration.submit": "มีใบสมัครใหม่",
  "member.approve": "อนุมัติสมาชิก",
  "member.reject": "ไม่อนุมัติสมาชิก",
  "member.view": "เปิดดูข้อมูลสมาชิก",
  "news.create": "สร้างข่าว",
  "news.update": "แก้ไขข่าว",
  "news.delete": "ลบข่าว",
  "news.publish": "เผยแพร่ข่าว",
  "news.unpublish": "ยกเลิกเผยแพร่ข่าว",
  "content.update": "แก้ไขข้อความบนเว็บ",
  "content.image": "เปลี่ยนรูปภาพบนเว็บ",
  "content.image_reset": "คืนค่ารูปภาพเริ่มต้น",
  "admin.login": "เข้าสู่ระบบ",
  "post.approve": "อนุมัติข่าวศิษย์เก่า",
  "post.hide": "ซ่อนข่าวศิษย์เก่า",
  "post.create": "ศิษย์เก่าส่งข่าว",
  "job.approve": "อนุมัติประกาศงาน",
  "job.create": "ศิษย์เก่าประกาศงาน",
  "kb.create": "ศิษย์เก่าส่งบทความ",
  "event.create": "สร้างกิจกรรม",
  "event.update": "แก้ไขกิจกรรม",
  "broadcast.send": "ส่งประกาศ",
  "pdpa.handle": "ดำเนินการคำขอ PDPA",
  "pdpa.erase": "ลบข้อมูลตามคำขอ",
  "member.import": "นำเข้าข้อมูลศิษย์เก่า",
  "member.merge": "รวมระเบียนซ้ำ",
  "member.export": "ส่งออกรายชื่อสมาชิก",
  "award.decide": "บันทึกผลศิษย์เก่าดีเด่น",
  "survey.create": "สร้างแบบสำรวจ",
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const session = await requireAdmin();
  const { denied } = await searchParams;
  const isAdmin = session.role === "admin" || session.role === "faculty"; // may see member figures

  const [stats, newsCounts, activity] = await Promise.all([
    isAdmin ? getMemberStats() : Promise.resolve(null),
    query<{ published: string; drafts: string }>(
      `SELECT count(*) FILTER (WHERE published_at IS NOT NULL AND published_at <= now()) AS published,
              count(*) FILTER (WHERE published_at IS NULL) AS drafts
       FROM news`,
    ),
    query<{ action: string; actor_name: string | null; created_at: Date; detail: Record<string, unknown> | null }>(
      `SELECT l.action, u.display_name AS actor_name, l.created_at, l.detail
       FROM audit_log l LEFT JOIN admin_user u ON u.id::text = l.actor
       WHERE l.action <> 'admin.login_failed' ${isAdmin ? "" : "AND l.action NOT LIKE 'member.%'"}
       ORDER BY l.created_at DESC LIMIT 10`,
    ),
  ]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ภาพรวม</h1>
          <p>สวัสดี {session.displayName}</p>
        </div>
      </div>

      {denied ? (
        <p className="flash flash-warn" role="alert">
          บัญชีของคุณไม่มีสิทธิ์เข้าถึงข้อมูลสมาชิก — ติดต่อผู้ดูแลระบบหากต้องการสิทธิ์นี้
        </p>
      ) : null}

      {stats ? (
        <>
          <div className="kpis">
            <Link href="/admin/members?status=verified" className="kpi">
              <div className="kpi-label">สมาชิกที่ยืนยันแล้ว</div>
              <div className="kpi-value">{formatNumber(stats.byStatus.verified)}</div>
              <div className="kpi-sub">จากทั้งหมด {formatNumber(stats.total)} ระเบียน</div>
            </Link>
            <Link href="/admin/members?status=pending" className={`kpi${stats.byStatus.pending ? " kpi-alert" : ""}`}>
              <div className="kpi-label">รอตรวจสอบ</div>
              <div className="kpi-value">{formatNumber(stats.byStatus.pending)}</div>
              <div className="kpi-sub">ใบสมัครค้าง {formatNumber(stats.pendingRequests)} รายการ</div>
            </Link>
            <Link href="/admin/members?status=unclaimed" className="kpi">
              <div className="kpi-label">นำเข้าแล้ว ยังไม่ Claim</div>
              <div className="kpi-value">{formatNumber(stats.byStatus.unclaimed)}</div>
              <div className="kpi-sub">ไม่แสดงในทำเนียบสาธารณะ</div>
            </Link>
            <div className="kpi">
              <div className="kpi-label">ข้อมูลเป็นปัจจุบัน (12 เดือน)</div>
              <div className="kpi-value">
                {stats.byStatus.verified
                  ? `${Math.round((stats.freshVerified / stats.byStatus.verified) * 100)}%`
                  : "—"}
              </div>
              <div className="kpi-sub">
                {formatNumber(stats.freshVerified)} จาก {formatNumber(stats.byStatus.verified)} คน
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">ใบสมัครเดือนนี้</div>
              <div className="kpi-value">{formatNumber(stats.newThisMonth)}</div>
              <div className="kpi-sub">ยินยอมแสดงในทำเนียบ {formatNumber(stats.directoryConsent)} คน</div>
            </div>
          </div>

          <div className="admin-grid-2">
            <section className="admin-card">
              <h2>สมาชิกที่ยืนยันแล้ว แยกตามระดับการศึกษา</h2>
              <CountBars
                rows={stats.byLevel.map((l) => ({
                  label: l.level,
                  value: l.verified,
                  href: `/admin/members?level=${encodeURIComponent(l.level)}`,
                }))}
              />
            </section>
            <section className="admin-card">
              <h2>แยกตามรุ่น (ปีที่เข้าศึกษา)</h2>
              <CountBars rows={stats.byCohortDecade.map((d) => ({ label: `พ.ศ. ${d.decade}`, value: d.verified }))} />
            </section>
          </div>

          <section className="admin-card">
            <h2>สาขาที่มีสมาชิกมากที่สุด</h2>
            <p className="small muted" style={{ marginTop: -8 }}>
              นับตามชื่อสาขาปัจจุบัน — ผู้ที่เรียนในชื่อเดิม (เช่น ช่างยนต์) ถูกรวมเข้ากับชื่อใหม่
            </p>
            <CountBars rows={stats.byProgram.map((p) => ({ label: `${p.level} ${p.program}`, value: p.verified }))} />
          </section>
        </>
      ) : null}

      <div className="admin-grid-2">
        <section className="admin-card">
          <h2>ข่าวประชาสัมพันธ์</h2>
          <p>
            เผยแพร่แล้ว <strong>{newsCounts[0]?.published ?? 0}</strong> ข่าว · ฉบับร่าง{" "}
            <strong>{newsCounts[0]?.drafts ?? 0}</strong> ข่าว
          </p>
          {session.role !== "faculty" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/admin/news/new" className="btn btn-primary btn-sm">+ เพิ่มข่าว</Link>
              <Link href="/admin/content" className="btn btn-outline btn-sm">แก้ไขข้อมูลเว็บ</Link>
            </div>
          ) : null}
        </section>

        <section className="admin-card">
          <h2>กิจกรรมล่าสุด</h2>
          {activity.length === 0 ? (
            <p className="muted">ยังไม่มีกิจกรรม</p>
          ) : (
            <ul className="small" style={{ display: "grid", gap: 8 }}>
              {activity.map((a, i) => (
                <li key={i}>
                  <strong>{ACTION_LABEL[a.action] ?? a.action}</strong>
                  {a.detail && typeof a.detail.title === "string" ? ` — ${a.detail.title}` : ""}
                  <br />
                  <span className="muted">
                    {a.actor_name ?? "ผู้เยี่ยมชม"} · {thaiDateTime(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
