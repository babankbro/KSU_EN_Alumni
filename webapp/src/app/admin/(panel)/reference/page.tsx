import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { addSkillAction, saveJobCategoryAction, updateProgramAction, updateSkillAction } from "../../reference-actions";

export const metadata = { title: "ข้อมูลอ้างอิง" };

const TABS = [
  { key: "programs", label: "หลักสูตร / สาขา" },
  { key: "skills", label: "ทักษะ" },
  { key: "categories", label: "กลุ่มอาชีพ" },
] as const;
const STATUS: Record<string, string> = { active: "เปิดสอน", renamed: "เปลี่ยนชื่อแล้ว", closed: "ปิดแล้ว", planned: "วางแผน" };
const DONE: Record<string, string> = { saved: "บันทึกแล้ว", deleted: "ลบแล้ว", merged: "รวมเข้ากับทักษะที่มีชื่อเดียวกันแล้ว", invalid: "ข้อมูลไม่ถูกต้อง" };

/** FR-ADM-05 — programme lineage, the skill list and job categories. */
export default async function ReferencePage({ searchParams }: { searchParams: Promise<{ tab?: string; done?: string }> }) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "programs";

  return (
    <>
      <div className="admin-head">
        <div><h1>ข้อมูลอ้างอิง</h1><p>รายการที่ใช้ทั้งระบบ — การเปลี่ยนชื่อสาขามีผลกับทำเนียบ สถิติ และรายงานทันที</p></div>
      </div>
      <nav className="admin-tabs" aria-label="ชนิดข้อมูล">
        {TABS.map((t) => <Link key={t.key} href={`/admin/reference?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>{t.label}</Link>)}
      </nav>
      {sp.done && DONE[sp.done] ? <p className={`flash flash-${sp.done === "invalid" ? "warn" : "ok"}`} role="status">{DONE[sp.done]}</p> : null}
      {tab === "programs" ? <Programs /> : tab === "skills" ? <Skills /> : <Categories />}
    </>
  );
}

async function Programs() {
  const rows = await query<{
    id: number; code: string; name_th: string; name_en: string | null; level: string; status: string; successor_id: number | null;
    verified: boolean; valid_from_year: number | null; valid_to_year: number | null; alumni: string;
  }>(
    `SELECT p.id, p.code, p.name_th, p.name_en, p.degree_level::text AS level, p.status::text AS status, p.successor_id, p.verified,
            p.valid_from_year, p.valid_to_year, (SELECT count(*) FROM alumni a WHERE a.program_id = p.id) AS alumni
     FROM program p ORDER BY p.degree_level, p.sort_order, p.name_th`,
  );
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead><tr><th scope="col">หลักสูตร</th><th scope="col" className="num">ศิษย์เก่า</th><th scope="col">แก้ไข</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.level} {p.name_th}</strong>
                <div className="small muted">{p.code}{p.valid_from_year ? ` · ${p.valid_from_year}–${p.valid_to_year ?? "ปัจจุบัน"}` : ""}{p.verified ? " · ✓ ยืนยันกับทะเบียน" : " · ยังไม่ยืนยัน"}</div>
              </td>
              <td className="num">{p.alumni}</td>
              <td>
                <form action={updateProgramAction} className="ref-form">
                  <input type="hidden" name="programId" value={p.id} />
                  <label className="sr-only" htmlFor={`pn${p.id}`}>ชื่อไทย</label>
                  <input id={`pn${p.id}`} name="nameTh" defaultValue={p.name_th} maxLength={150} />
                  <label className="sr-only" htmlFor={`pe${p.id}`}>ชื่ออังกฤษ</label>
                  <input id={`pe${p.id}`} name="nameEn" defaultValue={p.name_en ?? ""} placeholder="English name" maxLength={150} />
                  <label className="sr-only" htmlFor={`ps${p.id}`}>สถานะ</label>
                  <select id={`ps${p.id}`} name="status" defaultValue={p.status}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <label className="sr-only" htmlFor={`pu${p.id}`}>ชื่อใหม่ (สืบทอดโดย)</label>
                  <select id={`pu${p.id}`} name="successorId" defaultValue={p.successor_id ?? ""}>
                    <option value="">— ไม่มีหลักสูตรสืบทอด —</option>
                    {rows.filter((o) => o.id !== p.id).map((o) => <option key={o.id} value={o.id}>→ {o.level} {o.name_th}</option>)}
                  </select>
                  <label className="check-row small"><input type="checkbox" name="verified" defaultChecked={p.verified} /> <span>ยืนยันกับทะเบียน</span></label>
                  <button type="submit" className="btn btn-outline btn-sm">บันทึก</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Skills() {
  const rows = await query<{ id: number; name: string; alumni: string; jobs: string }>(
    `SELECT s.id, s.name, (SELECT count(*) FROM alumni_skill x WHERE x.skill_id = s.id) AS alumni,
            (SELECT count(*) FROM job_post_skill x WHERE x.skill_id = s.id) AS jobs
     FROM skill s ORDER BY s.name`,
  );
  return (
    <>
      <ActionForm action={addSkillAction} submitLabel="+ เพิ่มทักษะ" className="admin-card" resetOnSuccess>
        <Field name="skillName" label="ชื่อทักษะ" maxLength={60} hint="ตั้งชื่อเดิมซ้ำกับทักษะที่มีอยู่ตอนแก้ไข = รวมสองทักษะเข้าด้วยกัน" />
      </ActionForm>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">ทักษะ</th><th scope="col" className="num">ศิษย์เก่า</th><th scope="col" className="num">ประกาศงาน</th><th scope="col">แก้ไข</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="num">{s.alumni}</td>
                <td className="num">{s.jobs}</td>
                <td>
                  <form action={updateSkillAction} className="inline-actions">
                    <input type="hidden" name="skillId" value={s.id} />
                    <label className="sr-only" htmlFor={`s${s.id}`}>ชื่อใหม่</label>
                    <input id={`s${s.id}`} name="skillName" defaultValue={s.name} maxLength={60} />
                    <button type="submit" name="intent" value="rename" className="btn btn-outline btn-sm">บันทึก</button>
                    {Number(s.alumni) + Number(s.jobs) === 0 ? <button type="submit" name="intent" value="delete" className="link-danger">ลบ</button> : null}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function Categories() {
  const rows = await query<{ id: number; name: string; sort_order: number; used: string }>(
    `SELECT c.id, c.name, c.sort_order, (SELECT count(*) FROM employment e WHERE e.job_category = c.name) AS used FROM job_category c ORDER BY c.sort_order, c.name`,
  );
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead><tr><th scope="col">กลุ่มอาชีพ</th><th scope="col" className="num">ใช้อยู่</th><th scope="col">แก้ไข</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td className="num">{c.used}</td>
              <td>
                <form action={saveJobCategoryAction} className="inline-actions">
                  <input type="hidden" name="categoryId" value={c.id} />
                  <label className="sr-only" htmlFor={`c${c.id}`}>ชื่อ</label>
                  <input id={`c${c.id}`} name="categoryName" defaultValue={c.name} maxLength={60} />
                  <label className="sr-only" htmlFor={`o${c.id}`}>ลำดับ</label>
                  <input id={`o${c.id}`} name="sortOrder" type="number" defaultValue={c.sort_order} style={{ width: 80 }} />
                  <button type="submit" name="intent" value="save" className="btn btn-outline btn-sm">บันทึก</button>
                  {Number(c.used) === 0 ? <button type="submit" name="intent" value="delete" className="link-danger">ลบ</button> : null}
                </form>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}>
              <form action={saveJobCategoryAction} className="inline-actions">
                <label className="sr-only" htmlFor="newcat">กลุ่มอาชีพใหม่</label>
                <input id="newcat" name="categoryName" placeholder="กลุ่มอาชีพใหม่" maxLength={60} />
                <input name="sortOrder" type="number" defaultValue={100} style={{ width: 80 }} aria-label="ลำดับ" />
                <button type="submit" className="btn btn-primary btn-sm">+ เพิ่ม</button>
              </form>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
