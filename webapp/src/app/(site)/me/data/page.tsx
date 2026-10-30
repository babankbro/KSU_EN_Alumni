import { redirect } from "next/navigation";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { formatThaiDateTime } from "@/lib/server/format-server";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { createPdpaRequestAction } from "../actions";

export const metadata = { title: "ข้อมูลของฉัน (PDPA)" };

const TYPE_LABEL: Record<string, string> = {
  access: "ขอสำเนาข้อมูล (ฉบับที่เจ้าหน้าที่รับรอง)",
  rectify: "ขอแก้ไขข้อมูลที่ไม่ถูกต้อง",
  delete: "ขอลบข้อมูล / ปิดบัญชี",
  withdraw: "ถอนความยินยอมทั้งหมด",
  object: "คัดค้านการประมวลผล",
};
const STATUS_LABEL: Record<string, string> = { open: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", done: "เสร็จสิ้น", rejected: "ไม่อนุมัติ" };

export default async function MyDataPage() {
  const acc = await requireMember({ alumni: true });
  if (!acc.alumniId) redirect("/me?need=alumni");

  const requests = await query<{ type: string; detail: string | null; status: string; response: string | null; created_at: Date }>(
    `SELECT type::text, detail, status::text, response, created_at FROM pdpa_request WHERE alumni_id = $1 ORDER BY created_at DESC`,
    [acc.alumniId],
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ข้อมูลของฉัน</h1>
          <p>สิทธิของเจ้าของข้อมูลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</p>
        </div>
      </div>

      <section className="admin-card">
        <h2>ดาวน์โหลดข้อมูลทั้งหมดของฉัน</h2>
        <p className="small">ไฟล์ JSON ที่มีทุกอย่างที่ระบบเก็บเกี่ยวกับคุณ — โปรไฟล์ การทำงาน ความยินยอม ข่าวที่โพสต์ การลงทะเบียนกิจกรรม และคำตอบแบบสำรวจ</p>
        <a href="/me/data/export" className="btn btn-primary" download>ดาวน์โหลดข้อมูล (.json)</a>
      </section>

      <ActionForm action={createPdpaRequestAction} submitLabel="ส่งคำขอ" resetOnSuccess>
        <h2 style={{ fontSize: 18, margin: 0 }}>ยื่นคำขอใช้สิทธิ</h2>
        <Field
          name="type"
          label="ประเภทคำขอ"
          as="select"
          emptyLabel="— เลือก —"
          options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          required
        />
        <Field name="detail" label="รายละเอียด" as="textarea" rows={3} maxLength={2000} hint="สำหรับการแก้ไขหรือคัดค้าน กรุณาระบุว่าข้อมูลใดและเหตุผล" />
        <p className="small muted">
          “ถอนความยินยอม” มีผลทันทีกับการแสดงในทำเนียบและการรับข่าว ส่วน “ขอลบข้อมูล” เจ้าหน้าที่จะลบข้อมูลระบุตัวตน
          แต่เก็บปีที่เข้าศึกษาและสาขาแบบไม่ระบุตัวตนไว้สำหรับสถิติ
        </p>
      </ActionForm>

      <section className="admin-card">
        <h2>คำขอของฉัน</h2>
        {requests.length === 0 ? (
          <p className="muted">ยังไม่มีคำขอ</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>ยื่นเมื่อ</th><th>ประเภท</th><th>สถานะ</th><th>ผลการดำเนินการ</th></tr></thead>
              <tbody>
                {requests.map((r, i) => (
                  <tr key={i}>
                    <td className="small">{formatThaiDateTime(r.created_at)}</td>
                    <td>{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td><span className={`pill pill-${r.status === "done" ? "verified" : r.status === "rejected" ? "rejected" : "pending"}`}>{STATUS_LABEL[r.status]}</span></td>
                    <td className="small">{r.response ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
