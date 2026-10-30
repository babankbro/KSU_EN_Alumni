import { redirect } from "next/navigation";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import ActionForm from "@/components/forms/ActionForm";
import Field, { Check } from "@/components/forms/Field";
import { deleteEmploymentAction, saveEmploymentAction, saveSkillsAction } from "../actions";

export const metadata = { title: "การทำงานและทักษะ" };

const SECTORS = ["รัฐ", "รัฐวิสาหกิจ", "เอกชน", "ประกอบกิจการเอง", "อื่นๆ"];
const BANDS = ["ไม่เกิน 15,000", "15,001–20,000", "20,001–30,000", "30,001–40,000", "40,001–50,000", "มากกว่า 50,000"];

type Job = {
  id: number; organization: string; position: string; job_category: string | null; sector: string | null;
  salary_band: string | null; start: string | null; end: string | null; is_current: boolean; related: boolean | null;
};

function JobFields({ j, categories }: { j?: Job; categories: string[] }) {
  return (
    <>
      {j ? <input type="hidden" name="recordId" value={j.id} /> : null}
      <div className="field-grid">
        <Field name="organization" label="หน่วยงาน / บริษัท" defaultValue={j?.organization} required />
        <Field name="position" label="ตำแหน่ง" defaultValue={j?.position} required />
        <Field name="jobCategory" label="กลุ่มอาชีพ" as="select" options={categories} emptyLabel="— เลือก —" defaultValue={j?.job_category} />
        <Field name="sector" label="ประเภทหน่วยงาน" as="select" options={SECTORS} emptyLabel="— เลือก —" defaultValue={j?.sector} />
        <Field name="start" label="เริ่มงาน (เดือน/ปี ค.ศ.)" type="text" placeholder="2023-08" defaultValue={j?.start} hint="รูปแบบ YYYY-MM" />
        <Field name="end" label="ออกจากงาน" type="text" placeholder="2025-01" defaultValue={j?.end} hint="เว้นว่างถ้ายังทำอยู่" />
        <Field
          name="salaryBand"
          label="ช่วงรายได้ต่อเดือน (ไม่บังคับ)"
          as="select"
          options={BANDS}
          emptyLabel="ไม่ระบุ"
          defaultValue={j?.salary_band}
          hint="ใช้ในรายงานภาพรวมเท่านั้น ไม่แสดงรายบุคคล"
        />
        <Field
          name="related"
          label="ตรงกับสาขาที่จบหรือไม่"
          as="select"
          options={[{ value: "yes", label: "ตรง" }, { value: "no", label: "ไม่ตรง" }]}
          emptyLabel="ไม่ระบุ"
          defaultValue={j?.related === true ? "yes" : j?.related === false ? "no" : ""}
        />
      </div>
      <Check name="isCurrent" label="นี่คืองานปัจจุบันของฉัน" defaultChecked={j ? j.is_current : true} />
    </>
  );
}

export default async function CareerPage() {
  const acc = await requireMember({ alumni: true });
  if (!acc.alumniId) redirect("/me?need=alumni");

  const [jobs, skills, cats] = await Promise.all([
    query<Job>(
      `SELECT id, organization, position, job_category, sector::text, salary_band,
              to_char(start_month, 'YYYY-MM') AS start, to_char(end_month, 'YYYY-MM') AS "end",
              is_current, is_related_to_major AS related
       FROM employment WHERE alumni_id = $1 ORDER BY is_current DESC, start_month DESC NULLS LAST`,
      [acc.alumniId],
    ),
    query<{ name: string }>(`SELECT s.name FROM alumni_skill x JOIN skill s ON s.id = x.skill_id WHERE x.alumni_id = $1 ORDER BY s.name`, [acc.alumniId]),
    query<{ name: string }>(`SELECT name FROM job_category ORDER BY sort_order, name`),
  ]);
  const categories = cats.map((c) => c.name);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>การทำงานและทักษะ</h1>
          <p>เก็บเป็นประวัติต่อเนื่อง — ช่วยให้คณะติดตามเส้นทางอาชีพของบัณฑิตและปรับหลักสูตร</p>
        </div>
      </div>

      {jobs.map((j) => (
        <details key={j.id} className="admin-card">
          <summary style={{ cursor: "pointer" }}>
            <strong>{j.position}</strong> · {j.organization}{" "}
            {j.is_current ? <span className="pill pill-verified">ปัจจุบัน</span> : <span className="small muted">{j.start ?? "?"} – {j.end ?? "?"}</span>}
          </summary>
          <ActionForm action={saveEmploymentAction} submitLabel="บันทึกการแก้ไข" className="" secondary={null}>
            <JobFields j={j} categories={categories} />
          </ActionForm>
          <form action={deleteEmploymentAction} style={{ marginTop: 8 }}>
            <input type="hidden" name="recordId" value={j.id} />
            <button type="submit" className="link-danger">ลบรายการนี้</button>
          </form>
        </details>
      ))}

      <ActionForm action={saveEmploymentAction} submitLabel="+ เพิ่มประวัติการทำงาน" resetOnSuccess>
        <h2 style={{ fontSize: 18, margin: 0 }}>เพิ่มงาน</h2>
        <JobFields categories={categories} />
      </ActionForm>

      <ActionForm action={saveSkillsAction} submitLabel="บันทึกทักษะ">
        <h2 style={{ fontSize: 18, margin: 0 }}>ทักษะวิชาชีพ</h2>
        <Field
          name="skills"
          label="ทักษะ (คั่นด้วยเครื่องหมายจุลภาค)"
          as="textarea"
          rows={2}
          defaultValue={skills.map((s) => s.name).join(", ")}
          hint="เช่น PLC, ระบบฝังตัว, AutoCAD — ใช้ค้นหาในทำเนียบและจับคู่ประกาศงาน"
        />
      </ActionForm>
    </>
  );
}
