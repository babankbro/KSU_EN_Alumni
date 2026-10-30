import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { getSurvey, surveyReport } from "@/lib/server/surveys";
import { MIN_CELL } from "@/lib/surveys";
import CountBars from "@/components/admin/CountBars";
import { setSurveyStatusAction } from "../../../survey-actions";

export const metadata = { title: "ผลแบบสำรวจ" };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/** FR-SVY-05/07/08 — aggregate dashboard by programme, graduation year and time since graduation. */
export default async function SurveyDashboard({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ program?: string; grad?: string; created?: string }>;
}) {
  await requireAdmin(["admin", "faculty"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const survey = await getSurvey(id);
  if (!survey) notFound();
  const sp = await searchParams;
  const f = { program: /^\d+$/.test(sp.program ?? "") ? sp.program! : "", gradYear: /^\d{4}$/.test(sp.grad ?? "") ? sp.grad! : "" };

  const [report, programs, years] = await Promise.all([
    surveyReport(survey, f),
    query<{ id: number; name: string }>(
      `SELECT DISTINCT pr.current_id AS id, pr.degree_level::text || ' ' || pr.current_name_th AS name
       FROM survey_response r JOIN program_resolved pr ON pr.id = r.program_id WHERE r.survey_id = $1 ORDER BY name`,
      [id],
    ),
    query<{ y: number }>(`SELECT DISTINCT graduation_year AS y FROM survey_response WHERE survey_id = $1 AND graduation_year IS NOT NULL ORDER BY 1 DESC`, [id]),
  ]);
  const qs = new URLSearchParams({ ...(f.program ? { program: f.program } : {}), ...(f.gradYear ? { grad: f.gradYear } : {}) }).toString();

  return (
    <>
      <p className="small"><Link href="/admin/surveys">← แบบสำรวจทั้งหมด</Link></p>
      <div className="admin-head">
        <div>
          <h1>{survey.title}</h1>
          <p>{survey.audience === "alumni" ? "ผู้ตอบ: บัณฑิต" : "ผู้ตอบ: นายจ้าง / ผู้ใช้บัณฑิต"} · ตอบแล้ว {report.total} คน{qs ? " (ตามตัวกรอง)" : ""}</p>
        </div>
        <a href={`/admin/surveys/${id}/export${qs ? `?${qs}` : ""}`} className="btn btn-outline">⬇ ส่งออกรายงาน CSV</a>
      </div>
      {sp.created ? <p className="flash flash-ok" role="status">สร้างแบบสำรวจแล้ว (ฉบับร่าง) — เปิดรับเมื่อพร้อม</p> : null}

      <form action={setSurveyStatusAction} className="inline-actions admin-card" style={{ padding: 12 }}>
        <input type="hidden" name="surveyId" value={id} />
        <span>สถานะ: <strong>{survey.status === "open" ? "เปิดรับ" : survey.status === "draft" ? "ฉบับร่าง" : "ปิดแล้ว"}</strong></span>
        {survey.status !== "open" ? <button type="submit" name="status" value="open" className="btn btn-primary btn-sm">เปิดรับคำตอบ</button> : null}
        {survey.status === "open" ? <button type="submit" name="status" value="closed" className="btn btn-outline btn-sm">ปิดรับ</button> : null}
      </form>

      <form className="filter-bar" method="get">
        <div className="field">
          <label htmlFor="fp">สาขา (ชื่อปัจจุบัน)</label>
          <select id="fp" name="program" defaultValue={f.program}>
            <option value="">ทุกสาขา</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field narrow">
          <label htmlFor="fg">ปีที่สำเร็จการศึกษา</label>
          <select id="fg" name="grad" defaultValue={f.gradYear}>
            <option value="">ทุกปี</option>
            {years.map((y) => <option key={y.y} value={y.y}>{y.y}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">แสดงผล</button>
      </form>
      <p className="small muted">กลุ่มที่มีผู้ตอบน้อยกว่า {MIN_CELL} คนจะไม่แสดงสัดส่วน เพื่อไม่ให้ระบุตัวบุคคลได้ · รายได้แสดงเป็นช่วงเท่านั้น</p>

      {report.byProgram.length ? (
        <div className="admin-grid-2">
          <section className="admin-card">
            <h2>ภาวะการมีงานทำ แยกตามสาขา</h2>
            <table className="admin-table">
              <thead><tr><th scope="col">สาขา</th><th scope="col" className="num">ผู้ตอบ</th><th scope="col" className="num">มีงานทำ</th></tr></thead>
              <tbody>{report.byProgram.map((r) => (
                <tr key={r.program}><td>{r.program}</td><td className="num">{r.n}</td><td className="num">{r.employed === null ? "น้อยเกินไป" : pct(r.employed, r.n)}</td></tr>
              ))}</tbody>
            </table>
          </section>
          <section className="admin-card">
            <h2>ติดตามต่อเนื่อง — ตามจำนวนปีหลังจบ</h2>
            <table className="admin-table">
              <thead><tr><th scope="col">หลังจบ</th><th scope="col" className="num">ผู้ตอบ</th><th scope="col" className="num">มีงานทำ</th></tr></thead>
              <tbody>{report.byYears.map((r) => (
                <tr key={r.years}><td>{r.years === 0 ? "ปีที่จบ" : `${r.years} ปี`}</td><td className="num">{r.n}</td><td className="num">{r.employed === null ? "น้อยเกินไป" : pct(r.employed, r.n)}</td></tr>
              ))}</tbody>
            </table>
          </section>
        </div>
      ) : null}

      {report.questions.filter((q) => q.question.type === "single" || q.question.type === "scale").map((q) => (
        <section key={q.question.id} className="admin-card">
          <h2 style={{ fontSize: 17 }}>{q.question.label}</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            ตอบ {q.answered} คน{q.mean !== null ? ` · ค่าเฉลี่ย ${q.mean.toFixed(2)} จาก ${q.question.max ?? 5}` : ""}
          </p>
          {q.suppressed ? (
            <p className="muted">ผู้ตอบน้อยกว่า {MIN_CELL} คน — ไม่แสดงรายละเอียด</p>
          ) : q.counts ? (
            <CountBars rows={q.counts.map((c) => ({ label: `${c.option} (${pct(c.n, q.answered)})`, value: c.n }))} />
          ) : null}
        </section>
      ))}

      {report.texts.map((t) => (
        <section key={t.question} className="admin-card">
          <h2 style={{ fontSize: 17 }}>{t.question}</h2>
          <ul className="list-plain small">{t.answers.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      ))}
    </>
  );
}
