import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDate } from "@/lib/server/members";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { createSurveyAction } from "../../survey-actions";

export const metadata = { title: "แบบสำรวจ" };

const STATUS: Record<string, [string, string]> = { draft: ["ฉบับร่าง", "draft"], open: ["เปิดรับ", "published"], closed: ["ปิดแล้ว", "unclaimed"] };

export default async function AdminSurveysPage() {
  await requireAdmin(["admin", "faculty"]);
  const surveys = await query<{ id: number; title: string; audience: string; status: string; opens_at: Date | null; closes_at: Date | null; responses: string; invites: string }>(
    `SELECT s.id, s.title, s.audience, s.status, s.opens_at, s.closes_at,
            (SELECT count(*) FROM survey_response r WHERE r.survey_id = s.id) AS responses,
            (SELECT count(*) FROM employer_invite i WHERE i.survey_id = s.id) AS invites
     FROM survey s ORDER BY s.created_at DESC`,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>แบบสำรวจ</h1>
          <p>ภาวะการมีงานทำของบัณฑิต และความพึงพอใจของผู้ใช้บัณฑิต — สรุปผลสำหรับรายงานประกันคุณภาพ</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">แบบสำรวจ</th><th scope="col">ผู้ตอบ</th><th scope="col">ช่วงเวลา</th><th scope="col">สถานะ</th><th scope="col" className="num">คำตอบ</th></tr></thead>
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/admin/surveys/${s.id}`}><strong>{s.title}</strong></Link></td>
                <td>{s.audience === "alumni" ? "บัณฑิต" : `นายจ้าง (เชิญ ${s.invites})`}</td>
                <td className="small">{thaiDate(s.opens_at)} – {thaiDate(s.closes_at)}</td>
                <td><span className={`pill pill-${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></td>
                <td className="num">{s.responses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActionForm action={createSurveyAction} submitLabel="สร้างแบบสำรวจ (ฉบับร่าง)">
        <h2 style={{ fontSize: 18, margin: 0 }}>สร้างรอบใหม่</h2>
        <p className="small muted" style={{ margin: 0 }}>
          คัดลอกคำถามจากรอบก่อนเพื่อให้เทียบข้อมูลข้ามปีได้ (ติดตามต่อเนื่องหลายช่วงเวลา) หรือวางคำถามใหม่เป็น JSON
        </p>
        <Field name="title" label="ชื่อแบบสำรวจ" placeholder="เช่น ภาวะการมีงานทำของบัณฑิต ประจำปี 2570" maxLength={200} required />
        <Field as="textarea" name="description" label="คำอธิบายสำหรับผู้ตอบ" rows={2} maxLength={1000} />
        <div className="field-grid">
          <Field as="select" name="audience" label="กลุ่มผู้ตอบ" options={[{ value: "alumni", label: "บัณฑิต / ศิษย์เก่า" }, { value: "employer", label: "นายจ้าง / ผู้ใช้บัณฑิต" }]} emptyLabel="— เลือก —" required />
          <Field as="select" name="copyFrom" label="คัดลอกคำถามจาก" options={surveys.map((s) => ({ value: String(s.id), label: s.title }))} emptyLabel="— ไม่คัดลอก —" />
          <Field name="opensAt" type="datetime-local" label="เปิดรับ" />
          <Field name="closesAt" type="datetime-local" label="ปิดรับ" />
        </div>
        <Field as="textarea" name="questions" label="คำถาม (JSON — ไม่บังคับถ้าคัดลอกจากรอบก่อน)" rows={4} hint='เช่น [{"id":"status","type":"single","label":"สถานะ","options":["ทำงานแล้ว","ศึกษาต่อ"],"required":true}] · ชนิด: single, text, textarea, scale' />
      </ActionForm>
    </>
  );
}
