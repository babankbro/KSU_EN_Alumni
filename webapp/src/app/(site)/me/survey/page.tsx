import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { listOpenSurveys, prefillFor } from "@/lib/server/surveys";
import { formatThaiDateOnly } from "@/lib/server/format-server";
import SurveyWizard from "@/components/SurveyWizard";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { inviteEmployerAction, submitAlumniSurveyAction } from "./actions";

export const metadata = { title: "แบบสำรวจ" };

export default async function MySurveyPage() {
  const acc = await requireMember({ alumni: true });
  const verified = acc.claimStatus === "verified";
  const surveys = await listOpenSurveys("alumni");
  const done = new Set(
    (await query<{ survey_id: number }>(`SELECT survey_id FROM survey_response WHERE alumni_id = $1`, [acc.alumniId])).map((r) => r.survey_id),
  );
  const todo = surveys.find((s) => !done.has(s.id));
  const initial = todo && acc.alumniId ? await prefillFor(acc.alumniId, todo.questions) : {};
  const employerOpen = (await listOpenSurveys("employer")).length > 0;
  const invites = await query<{ employer_name: string; created_at: Date; responded_at: Date | null; expired: boolean }>(
    `SELECT employer_name, created_at, responded_at, expires_at < now() AS expired FROM employer_invite WHERE alumni_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [acc.alumniId],
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>แบบสำรวจ</h1>
          <p>ข้อมูลภาวะการทำงานของบัณฑิตใช้ปรับปรุงหลักสูตรและรายงานประกันคุณภาพ — รายได้แสดงเป็นช่วงและแบบรวมกลุ่มเท่านั้น</p>
        </div>
      </div>

      {!verified ? (
        <p className="flash flash-warn" role="status">ตอบแบบสำรวจได้หลังเจ้าหน้าที่ยืนยันตัวตนของคุณแล้ว</p>
      ) : todo ? (
        <>
          <h2 style={{ fontSize: 20 }}>{todo.title}</h2>
          {todo.description ? <p className="muted">{todo.description}{todo.closesAt ? ` · ปิดรับ ${formatThaiDateOnly(todo.closesAt)}` : ""}</p> : null}
          <SurveyWizard questions={todo.questions} initial={initial} action={submitAlumniSurveyAction} hidden={{ surveyId: String(todo.id) }} />
        </>
      ) : (
        <p className="admin-card">{surveys.length ? "✓ คุณตอบแบบสำรวจที่เปิดอยู่ครบแล้ว ขอบคุณครับ/ค่ะ" : "ขณะนี้ไม่มีแบบสำรวจที่เปิดรับ"}</p>
      )}

      {verified && employerOpen ? (
        <section className="admin-card">
          <h2>เชิญหัวหน้างานตอบแบบสำรวจผู้ใช้บัณฑิต</h2>
          <p className="small muted">ระบบจะส่งลิงก์ที่ใช้ได้ครั้งเดียวไปยังอีเมลของหัวหน้างาน ไม่ต้องสมัครสมาชิก คุณจะไม่เห็นคำตอบรายบุคคล</p>
          <ActionForm action={inviteEmployerAction} submitLabel="ส่งคำเชิญ" pendingLabel="กำลังส่ง…" className="" resetOnSuccess>
            <div className="field-grid">
              <Field name="employerName" label="ชื่อหัวหน้างาน / หน่วยงาน" maxLength={150} />
              <Field name="employerEmail" type="email" label="อีเมลหัวหน้างาน" />
            </div>
          </ActionForm>
          {invites.length ? (
            <ul className="list-plain small" style={{ marginTop: 12 }}>
              {invites.map((i, k) => (
                <li key={k}>
                  {i.employer_name} · ส่งเมื่อ {formatThaiDateOnly(i.created_at)} ·{" "}
                  {i.responded_at ? "✓ ตอบแล้ว" : i.expired ? "หมดอายุ" : "รอตอบ"}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
