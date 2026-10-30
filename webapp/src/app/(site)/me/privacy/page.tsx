import { redirect } from "next/navigation";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { fieldVisibility, VIS_FIELDS, VIS_FIELD_LABEL, type Visibility } from "@/lib/server/profile";
import ActionForm from "@/components/forms/ActionForm";
import Field, { Check } from "@/components/forms/Field";
import { savePrivacyAction } from "../actions";

export const metadata = { title: "ติดต่อและความเป็นส่วนตัว" };

const LEVELS: { v: Visibility; label: string }[] = [
  { v: "public", label: "ทุกคน" },
  { v: "members", label: "เฉพาะศิษย์เก่า" },
  { v: "private", label: "ไม่แสดง" },
];

export default async function PrivacyPage() {
  const acc = await requireMember({ alumni: true });
  if (!acc.alumniId) redirect("/me?need=alumni");

  const [c] = await query<{ email: string | null; phone: string | null; line_id: string | null; province: string | null; visibility: Visibility; field_visibility: Record<string, string> }>(
    `SELECT email, phone, line_id, province, visibility, field_visibility FROM alumni_contact WHERE alumni_id = $1`,
    [acc.alumniId],
  );
  const consents = await query<{ purpose: string; granted: boolean }>(
    `SELECT purpose::text, granted FROM alumni_latest_consent WHERE alumni_id = $1`,
    [acc.alumniId],
  );
  const consent = Object.fromEntries(consents.map((r) => [r.purpose, r.granted]));
  const fallback = c?.visibility ?? "members";

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ติดต่อและความเป็นส่วนตัว</h1>
          <p>เลือกได้ทีละช่องว่าใครเห็นอะไร — เจ้าหน้าที่คณะเห็นข้อมูลติดต่อเสมอเพื่อใช้ติดต่อคุณ</p>
        </div>
      </div>

      <ActionForm action={savePrivacyAction} submitLabel="บันทึกการตั้งค่า">
        <h2 style={{ fontSize: 18, margin: 0 }}>ข้อมูลติดต่อ</h2>
        <div className="field-grid">
          <Field name="email" label="อีเมล" type="email" defaultValue={c?.email ?? acc.email} required hint="ใช้รับการแจ้งเตือนด้วย" />
          <Field name="phone" label="เบอร์โทรศัพท์" type="tel" defaultValue={c?.phone} />
          <Field name="lineId" label="LINE ID" defaultValue={c?.line_id} />
          <Field name="province" label="จังหวัดที่อยู่ปัจจุบัน" defaultValue={c?.province} />
        </div>

        <h2 style={{ fontSize: 18, margin: "12px 0 0" }}>ใครเห็นข้อมูลแต่ละช่อง</h2>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">ระดับการเปิดเผยข้อมูลแต่ละช่อง</legend>
          <div className="vis-grid" role="table">
            <span className="vis-head" role="columnheader">ข้อมูล</span>
            {LEVELS.map((l) => (
              <span key={l.v} className="vis-head" role="columnheader">{l.label}</span>
            ))}
            {VIS_FIELDS.map((f) => {
              const current = fieldVisibility(c?.field_visibility ?? {}, fallback, f);
              return (
                <div key={f} style={{ display: "contents" }} role="row">
                  <span role="rowheader">{VIS_FIELD_LABEL[f]}</span>
                  {LEVELS.map((l) => (
                    <label key={l.v} role="cell" style={{ display: "flex", justifyContent: "center" }}>
                      <input type="radio" name={`vis_${f}`} value={l.v} defaultChecked={current === l.v} />
                      <span className="sr-only">{VIS_FIELD_LABEL[f]}: {l.label}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </fieldset>
        <p className="small muted">“เฉพาะศิษย์เก่า” หมายถึงศิษย์เก่าที่เจ้าหน้าที่ยืนยันตัวตนแล้วเท่านั้น นักศึกษาปัจจุบันและบุคคลทั่วไปไม่เห็น</p>

        <h2 style={{ fontSize: 18, margin: "12px 0 0" }}>ความยินยอม</h2>
        <Check
          name="consentDirectory"
          defaultChecked={Boolean(consent.directory_listing)}
          label={<><strong>แสดงชื่อของฉันในทำเนียบศิษย์เก่า</strong> — ถ้าไม่เลือก ระเบียนของคุณจะไม่ปรากฏในการค้นหาเลย</>}
        />
        <Check
          name="consentNews"
          defaultChecked={Boolean(consent.news)}
          label={<><strong>รับข่าวสารและกิจกรรมจากคณะ</strong></>}
        />
        <p className="small muted">การเปลี่ยนความยินยอมถูกบันทึกเป็นประวัติพร้อมวันเวลา (ไม่แก้บันทึกเดิม)</p>
      </ActionForm>
    </>
  );
}
