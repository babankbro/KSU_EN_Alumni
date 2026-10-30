import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { query } from "@/lib/server/db";
import { JOB_TYPES } from "@/lib/server/jobs";
import { KB_CATEGORIES } from "@/lib/server/kb";
import { PROVINCES } from "@/lib/provinces";
import { saveArticleAction, saveJobAction } from "./actions";

export interface EditableJob {
  id: number; title: string; organization: string; type: string; location: string | null; province: string | null;
  description: string | null; closesAt: string | null; applyUrl: string | null; contactEmail: string | null;
  programIds: number[]; skills: string[];
}

/** FR-JOB-01 — job form shared by /me/jobs/new and /me/jobs/[id]. */
export async function JobEditor({ job }: { job?: EditableJob }) {
  const programs = await query<{ id: number; name: string }>(
    `SELECT id, degree_level::text || ' ' || name_th AS name FROM program_resolved WHERE id = current_id ORDER BY degree_level, name_th`,
  );
  const chosen = new Set(job?.programIds ?? []);
  return (
    <ActionForm action={saveJobAction} submitLabel="ส่งให้ผู้ตรวจสอบ" pendingLabel="กำลังส่ง…">
      {job ? <input type="hidden" name="recordId" value={job.id} /> : null}
      <div className="field-grid">
        <Field name="title" label="ตำแหน่ง" defaultValue={job?.title} maxLength={150} required />
        <Field name="organization" label="หน่วยงาน / บริษัท" defaultValue={job?.organization} maxLength={150} required />
        <Field as="select" name="employmentType" label="ประเภท" options={[...JOB_TYPES]} emptyLabel="— เลือก —" defaultValue={job?.type} required />
        <Field name="closesAt" type="date" label="วันปิดรับ" defaultValue={job?.closesAt} required hint="ประกาศหมดอายุอัตโนมัติหลังวันนี้" />
        <Field as="select" name="province" label="จังหวัด" options={[...PROVINCES]} emptyLabel="— ไม่ระบุ —" defaultValue={job?.province} />
        <Field name="location" label="สถานที่ทำงาน (เช่น นิคมอุตสาหกรรม)" defaultValue={job?.location} maxLength={150} />
      </div>
      <Field as="textarea" name="description" label="รายละเอียดงานและคุณสมบัติ" rows={8} maxLength={8000} defaultValue={job?.description} required />
      <div className="field-grid">
        <Field name="applyUrl" type="url" label="ลิงก์สมัคร (https://…)" defaultValue={job?.applyUrl} />
        <Field name="contactEmail" type="email" label="อีเมลรับสมัคร" defaultValue={job?.contactEmail} />
      </div>
      <fieldset className="field">
        <legend>สาขาที่รับ (ไม่เลือก = ทุกสาขา)</legend>
        <div className="check-grid">
          {programs.map((p) => (
            <label key={p.id} className="check-row">
              <input type="checkbox" name="programs" value={p.id} defaultChecked={chosen.has(p.id)} /> <span>{p.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field name="skills" label="ทักษะที่ต้องการ (คั่นด้วยจุลภาค)" defaultValue={job?.skills.join(", ")} hint="ใช้ชื่อทักษะตามรายการของคณะ ระบบจะแจ้งเตือนศิษย์เก่าและนักศึกษาที่มีทักษะหรือสาขาตรงกัน" />
      <p className="small muted" style={{ margin: 0 }}>ประกาศงานทุกชิ้นผ่านการตรวจสอบก่อนเผยแพร่ การแก้ไขจะส่งกลับไปตรวจสอบอีกครั้ง</p>
    </ActionForm>
  );
}

export interface EditableArticle { id: number; title: string; summary: string | null; body: string; category: string }

/** FR-KB-01 — article form. */
export function ArticleEditor({ article }: { article?: EditableArticle }) {
  return (
    <ActionForm action={saveArticleAction} submitLabel="ส่งให้ผู้ตรวจสอบ" pendingLabel="กำลังส่ง…">
      {article ? <input type="hidden" name="recordId" value={article.id} /> : null}
      <Field name="title" label="หัวข้อ" defaultValue={article?.title} maxLength={150} required />
      <Field as="select" name="category" label="หมวด" options={[...KB_CATEGORIES]} emptyLabel="— เลือก —" defaultValue={article?.category} required />
      <Field name="summary" label="สรุปสั้น ๆ (แสดงในหน้ารวม)" defaultValue={article?.summary} maxLength={300} />
      <Field as="textarea" name="body" label="เนื้อหา" rows={14} maxLength={20000} defaultValue={article?.body} required hint="อย่างน้อย 100 ตัวอักษร — หลีกเลี่ยงการเปิดเผยข้อมูลส่วนตัวของผู้อื่น" />
    </ActionForm>
  );
}
