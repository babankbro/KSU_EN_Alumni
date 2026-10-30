import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDateTime } from "@/lib/server/members";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { createStaffAction, updateStaffAction } from "../../staff-actions";

export const metadata = { title: "บัญชีเจ้าหน้าที่" };

const ROLE: Record<string, string> = { admin: "ผู้ดูแลระบบ", editor: "ผู้แก้ไขเนื้อหา", faculty: "อาจารย์ / กรรมการ" };
const DONE: Record<string, [string, "ok" | "warn"]> = {
  role: ["เปลี่ยนบทบาทแล้ว — มีผลเมื่อเข้าสู่ระบบครั้งถัดไป", "ok"],
  toggle: ["เปลี่ยนสถานะบัญชีแล้ว", "ok"],
  password: ["ตั้งรหัสผ่านใหม่แล้ว", "ok"],
  self: ["เปลี่ยนบทบาทหรือปิดบัญชีของตนเองไม่ได้", "warn"],
  last_admin: ["ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อยหนึ่งบัญชี", "warn"],
  weak_password: ["รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข", "warn"],
  invalid: ["คำสั่งไม่ถูกต้อง", "warn"],
};

/** FR-ADM-03 — staff accounts and what each role may do. */
export default async function StaffPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const session = await requireAdmin("admin");
  const { done } = await searchParams;
  const msg = done ? DONE[done] : undefined;
  const staff = await query<{ id: string; email: string; display_name: string; role: string; is_active: boolean; last_login_at: Date | null }>(
    `SELECT id, email, display_name, role::text AS role, is_active, last_login_at FROM admin_user ORDER BY is_active DESC, role, display_name`,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>บัญชีเจ้าหน้าที่</h1>
          <p>ผู้ดูแลระบบ: ทุกอย่าง · ผู้แก้ไขเนื้อหา: ข่าว กิจกรรม แกลเลอรี ตรวจสอบเนื้อหา · อาจารย์/กรรมการ: ข้อมูลสมาชิก (อ่าน) ศิษย์เก่าดีเด่น แบบสำรวจ</p>
        </div>
      </div>
      {msg ? <p className={`flash flash-${msg[1]}`} role={msg[1] === "ok" ? "status" : "alert"}>{msg[0]}</p> : null}

      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">ชื่อ</th><th scope="col">บทบาท</th><th scope="col">สถานะ</th><th scope="col">เข้าใช้ล่าสุด</th><th scope="col">ตั้งรหัสผ่านใหม่</th></tr></thead>
          <tbody>
            {staff.map((s) => {
              const self = s.id === session.id;
              return (
                <tr key={s.id} className={s.is_active ? undefined : "muted"}>
                  <td><strong>{s.display_name}</strong>{self ? " (คุณ)" : ""}<div className="small muted">{s.email}</div></td>
                  <td>
                    {self ? ROLE[s.role] : (
                      <form action={updateStaffAction} className="inline-actions">
                        <input type="hidden" name="staffId" value={s.id} />
                        <input type="hidden" name="intent" value="role" />
                        <label className="sr-only" htmlFor={`r${s.id}`}>บทบาทของ {s.display_name}</label>
                        <select id={`r${s.id}`} name="role" defaultValue={s.role}>
                          {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button type="submit" className="btn btn-outline btn-sm">บันทึก</button>
                      </form>
                    )}
                  </td>
                  <td>
                    {self ? <span className="pill pill-verified">ใช้งาน</span> : (
                      <form action={updateStaffAction}>
                        <input type="hidden" name="staffId" value={s.id} />
                        <input type="hidden" name="intent" value="toggle" />
                        <button type="submit" className={`btn btn-sm ${s.is_active ? "btn-outline" : "btn-primary"}`}>{s.is_active ? "ปิดบัญชี" : "เปิดใช้งาน"}</button>
                      </form>
                    )}
                  </td>
                  <td className="small">{thaiDateTime(s.last_login_at)}</td>
                  <td>
                    <form action={updateStaffAction} className="inline-actions">
                      <input type="hidden" name="staffId" value={s.id} />
                      <input type="hidden" name="intent" value="password" />
                      <label className="sr-only" htmlFor={`p${s.id}`}>รหัสผ่านใหม่ของ {s.display_name}</label>
                      <input id={`p${s.id}`} name="password" type="password" autoComplete="new-password" placeholder="อย่างน้อย 12 ตัว" minLength={12} />
                      <button type="submit" className="btn btn-outline btn-sm">ตั้ง</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ActionForm action={createStaffAction} submitLabel="+ สร้างบัญชี" resetOnSuccess>
        <h2 style={{ fontSize: 18, margin: 0 }}>เพิ่มเจ้าหน้าที่</h2>
        <div className="field-grid">
          <Field name="displayName" label="ชื่อที่แสดง" maxLength={100} required />
          <Field name="email" type="email" label="อีเมล" required />
          <Field as="select" name="role" label="บทบาท" options={Object.entries(ROLE).map(([value, label]) => ({ value, label }))} emptyLabel="— เลือก —" required />
          <Field name="password" type="password" label="รหัสผ่านชั่วคราว" autoComplete="new-password" required hint="อย่างน้อย 12 ตัวอักษร มีทั้งตัวอักษรและตัวเลข" />
        </div>
      </ActionForm>
    </>
  );
}
