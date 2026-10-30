import { requireMember } from "@/lib/server/member-auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { addFormerNameAction, removeFormerNameAction, removePhotoAction, saveProfileAction, uploadPhotoAction } from "../actions";

export const metadata = { title: "ชื่อและรูป" };

export default async function MyProfilePage() {
  const acc = await requireMember({ alumni: true });
  if (!acc.alumniId) redirect("/me?need=alumni");

  const [a] = await query<{
    title_th: string; first_name_th: string; last_name_th: string; first_name_en: string | null;
    last_name_en: string | null; nickname: string | null; photo_file_id: string | null;
    program: string; program_current: string; admission_year: number; graduation_year: number | null; student_code: string | null;
  }>(
    `SELECT a.title_th, a.first_name_th, a.last_name_th, a.first_name_en, a.last_name_en, a.nickname, a.photo_file_id,
            p.name_th AS program, p.current_name_th AS program_current, a.admission_year, a.graduation_year, a.student_code
     FROM alumni a JOIN program_resolved p ON p.id = a.program_id WHERE a.id = $1`,
    [acc.alumniId],
  );
  const former = await query<{ id: number; first_name_th: string; last_name_th: string }>(
    `SELECT id, first_name_th, last_name_th FROM alumni_former_name WHERE alumni_id = $1 ORDER BY id`,
    [acc.alumniId],
  );

  return (
    <>
      <div className="admin-head"><h1>ชื่อและรูป</h1></div>

      <section className="admin-card">
        <h2>รูปโปรไฟล์</h2>
        <div className="member-head" style={{ marginBottom: 12 }}>
          {a.photo_file_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="member-photo" src={fileUrl(a.photo_file_id)} alt="รูปโปรไฟล์ของคุณ" />
          ) : (
            <div className="member-photo-ph" aria-hidden="true">{a.first_name_th.slice(0, 2)}</div>
          )}
          <p className="small muted" style={{ margin: 0 }}>ใครเห็นรูปนี้ได้บ้าง ตั้งค่าได้ที่ “ติดต่อและความเป็นส่วนตัว”</p>
        </div>
        <ActionForm action={uploadPhotoAction} submitLabel="อัปโหลดรูป" className="" encType="multipart/form-data">
          <div className="field">
            <label htmlFor="photo">เลือกรูปใหม่ (JPG, PNG, WebP ไม่เกิน 5 MB)</label>
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
          </div>
        </ActionForm>
        {a.photo_file_id ? (
          <form action={removePhotoAction} style={{ marginTop: 8 }}>
            <button type="submit" className="link-danger">นำรูปออก</button>
          </form>
        ) : null}
      </section>

      <ActionForm action={saveProfileAction} submitLabel="บันทึกชื่อ">
        <h2 style={{ fontSize: 18, margin: 0 }}>ชื่อ</h2>
        <div className="field-grid">
          <Field name="titleTh" label="คำนำหน้า" defaultValue={a.title_th} required />
          <Field name="nickname" label="ชื่อเล่น" defaultValue={a.nickname} maxLength={40} />
          <Field name="firstNameTh" label="ชื่อ (ไทย)" defaultValue={a.first_name_th} required />
          <Field name="lastNameTh" label="นามสกุล (ไทย)" defaultValue={a.last_name_th} required hint="ถ้าเปลี่ยนชื่อหรือนามสกุล ระบบจะเก็บชื่อเดิมไว้ให้อัตโนมัติ" />
          <Field name="firstNameEn" label="First name" defaultValue={a.first_name_en} />
          <Field name="lastNameEn" label="Last name" defaultValue={a.last_name_en} />
        </div>
      </ActionForm>

      <section className="admin-card">
        <h2>ชื่อ-นามสกุลเดิม</h2>
        <p className="small muted">ช่วยให้เพื่อนที่จำชื่อเดิมได้ค้นหาคุณเจอ</p>
        {former.length ? (
          <ul className="list-plain">
            {former.map((f) => (
              <li key={f.id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                <span>{f.first_name_th} {f.last_name_th}</span>
                <form action={removeFormerNameAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="link-danger">ลบ<span className="sr-only"> {f.first_name_th} {f.last_name_th}</span></button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={addFormerNameAction} submitLabel="+ เพิ่มชื่อเดิม" className="" submitClassName="btn btn-outline btn-sm" resetOnSuccess>
          <div className="field-grid">
            <Field name="firstNameTh" label="ชื่อเดิม" />
            <Field name="lastNameTh" label="นามสกุลเดิม" />
          </div>
        </ActionForm>
      </section>

      <section className="admin-card">
        <h2>ข้อมูลการศึกษา</h2>
        <dl className="kv">
          <dt>สาขา</dt>
          <dd>{a.program}{a.program !== a.program_current ? ` (ปัจจุบัน: ${a.program_current})` : ""}</dd>
          <dt>รุ่น / ปีที่จบ</dt>
          <dd>{a.admission_year} / {a.graduation_year ?? "—"}</dd>
          <dt>รหัสนักศึกษา</dt>
          <dd>{a.student_code ?? "—"}</dd>
        </dl>
        <p className="small muted" style={{ marginTop: 12 }}>
          ข้อมูลการศึกษายืนยันกับงานทะเบียน ถ้าไม่ถูกต้องให้ยื่นคำขอแก้ไขที่หน้า “ข้อมูลของฉัน (PDPA)”
        </p>
      </section>
    </>
  );
}
