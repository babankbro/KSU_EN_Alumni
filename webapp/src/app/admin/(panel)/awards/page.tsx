import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDateTime } from "@/lib/server/members";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { createRoundAction } from "../../award-actions";

export const metadata = { title: "ศิษย์เก่าดีเด่น" };

export default async function AdminAwardsPage() {
  await requireAdmin(["admin", "faculty"]);
  const rounds = await query<{
    id: number; title: string; opens_at: Date; closes_at: Date; state: string; total: string; awarded: string; open_n: string;
  }>(
    `SELECT r.id, r.title, r.opens_at, r.closes_at,
            CASE WHEN now() < r.opens_at THEN 'upcoming' WHEN now() <= r.closes_at THEN 'open' ELSE 'closed' END AS state,
            (SELECT count(*) FROM award_nomination n WHERE n.round_id = r.id) AS total,
            (SELECT count(*) FROM award_nomination n WHERE n.round_id = r.id AND n.status = 'awarded') AS awarded,
            (SELECT count(*) FROM award_nomination n WHERE n.round_id = r.id AND n.status IN ('submitted', 'shortlisted')) AS open_n
     FROM award_round r ORDER BY r.closes_at DESC`,
  );
  const STATE: Record<string, [string, string]> = { upcoming: ["ยังไม่เปิด", "draft"], open: ["เปิดรับ", "published"], closed: ["ปิดรับแล้ว", "unclaimed"] };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ศิษย์เก่าดีเด่น</h1>
          <p>รอบการเสนอชื่อ และผลการพิจารณาของกรรมการ</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">รอบ</th><th scope="col">ช่วงเวลา</th><th scope="col">สถานะ</th><th scope="col" className="num">เสนอชื่อ</th><th scope="col" className="num">รอพิจารณา</th><th scope="col" className="num">ได้รับรางวัล</th></tr></thead>
          <tbody>
            {rounds.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 32 }}>ยังไม่มีรอบ</td></tr>
            ) : rounds.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/awards/${r.id}`}><strong>{r.title}</strong></Link></td>
                <td className="small">{thaiDateTime(r.opens_at)} – {thaiDateTime(r.closes_at)}</td>
                <td><span className={`pill pill-${STATE[r.state][1]}`}>{STATE[r.state][0]}</span></td>
                <td className="num">{r.total}</td>
                <td className="num">{r.open_n}</td>
                <td className="num">{r.awarded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActionForm action={createRoundAction} submitLabel="+ สร้างรอบใหม่" resetOnSuccess>
        <h2 style={{ fontSize: 18, margin: 0 }}>สร้างรอบการเสนอชื่อ</h2>
        <Field name="title" label="ชื่อรอบ" placeholder="เช่น ศิษย์เก่าดีเด่น ประจำปี 2571" maxLength={200} required />
        <Field as="textarea" name="description" label="คำอธิบาย / เกณฑ์" rows={3} maxLength={2000} />
        <div className="field-grid">
          <Field name="opensAt" type="datetime-local" label="เปิดรับ" required />
          <Field name="closesAt" type="datetime-local" label="ปิดรับ" required />
        </div>
      </ActionForm>
    </>
  );
}
