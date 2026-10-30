import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDateTime } from "@/lib/server/members";
import { IMPORT_COLUMNS } from "@/lib/server/data-admin";
import ActionForm from "@/components/forms/ActionForm";
import { importCsvAction } from "../../data-actions";

export const metadata = { title: "นำเข้าข้อมูลศิษย์เก่า" };

/** FR-ADM-01 — registrar CSV import into unclaimed records. */
export default async function ImportPage() {
  await requireAdmin("admin");
  const [batches, programs] = await Promise.all([
    query<{ id: number; filename: string; total: number; inserted: number; skipped: number; errors: unknown[]; created_at: Date; who: string | null }>(
      `SELECT b.id, b.filename, b.total, b.inserted, b.skipped, b.errors, b.created_at, u.display_name AS who
       FROM import_batch b LEFT JOIN admin_user u ON u.id = b.created_by ORDER BY b.created_at DESC LIMIT 20`,
    ),
    query<{ code: string; name: string }>(`SELECT code, degree_level::text || ' ' || name_th AS name FROM program ORDER BY degree_level, sort_order, name_th`),
  ]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>นำเข้าข้อมูลศิษย์เก่า</h1>
          <p>ไฟล์จากงานทะเบียนจะถูกนำเข้าเป็นระเบียน “ยังไม่ Claim” — ไม่แสดงในทำเนียบจนกว่าเจ้าตัวจะยืนยันตัวตน</p>
        </div>
        <a className="btn btn-outline" href={`data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(IMPORT_COLUMNS.join(",") + "\r\n6400000001,นาย,ตัวอย่าง,นำเข้า,beng-cpe,2564,2568,2003-05-01,1234\r\n")}`} download="alumni-import-template.csv">
          ⬇ ไฟล์ตัวอย่าง
        </a>
      </div>

      <ActionForm action={importCsvAction} submitLabel="นำเข้า" pendingLabel="กำลังนำเข้า…" encType="multipart/form-data">
        <div className="field">
          <label htmlFor="csv">ไฟล์ CSV (UTF-8, ไม่เกิน 5 MB / 5,000 แถว)</label>
          <input id="csv" name="file" type="file" accept=".csv,text/csv" />
          <p className="field-hint">
            คอลัมน์: {IMPORT_COLUMNS.join(", ")} · ปีเป็น พ.ศ. · วันเกิดเป็น ค.ศ. YYYY-MM-DD · id_last4 = เลขบัตร 4 หลักท้าย (เก็บแบบเข้ารหัสทางเดียว)
            · รหัสนักศึกษาที่มีอยู่แล้วจะถูกข้าม ไม่เขียนทับ
          </p>
        </div>
      </ActionForm>

      <details className="admin-card">
        <summary>รหัสหลักสูตร (program_code) ที่ใช้ได้</summary>
        <table className="admin-table" style={{ marginTop: 12 }}>
          <tbody>{programs.map((p) => <tr key={p.code}><td><code>{p.code}</code></td><td>{p.name}</td></tr>)}</tbody>
        </table>
      </details>

      <section className="admin-card">
        <h2>ประวัติการนำเข้า</h2>
        {batches.length === 0 ? <p className="muted">ยังไม่เคยนำเข้า</p> : (
          <table className="admin-table">
            <thead><tr><th scope="col">ไฟล์</th><th scope="col">เมื่อ</th><th scope="col" className="num">ทั้งหมด</th><th scope="col" className="num">เพิ่ม</th><th scope="col" className="num">ข้าม</th><th scope="col" className="num">ผิดพลาด</th></tr></thead>
            <tbody>{batches.map((b) => (
              <tr key={b.id}><td>{b.filename}</td><td className="small">{thaiDateTime(b.created_at)} · {b.who ?? "—"}</td><td className="num">{b.total}</td><td className="num">{b.inserted}</td><td className="num">{b.skipped}</td><td className="num">{b.errors.length}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}
