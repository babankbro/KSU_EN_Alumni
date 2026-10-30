import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/forms/ActionForm";
import Field, { Check } from "@/components/forms/Field";
import { studentSignupAction } from "../../member-actions";

export const metadata: Metadata = { title: "สร้างบัญชีนักศึกษา" };

export default function StudentSignupPage() {
  return (
    <div className="wrap auth-wrap">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <h1>บัญชีนักศึกษาปัจจุบัน</h1>
        <p className="muted small">
          ใช้ดูประกาศงาน ฝึกงาน สหกิจศึกษา ข่าว และกิจกรรม และรับแจ้งเตือนงานที่ตรงกับสาขา — บัญชีนักศึกษา
          <strong>ไม่ปรากฏในทำเนียบศิษย์เก่า</strong>และไม่เห็นข้อมูลติดต่อของศิษย์เก่า
        </p>
        <ActionForm action={studentSignupAction} submitLabel="สร้างบัญชี">
          <Field name="studentCode" label="รหัสนักศึกษา" inputMode="numeric" required />
          <div className="field-grid">
            <Field name="firstName" label="ชื่อ" autoComplete="given-name" required />
            <Field name="lastName" label="นามสกุล" autoComplete="family-name" required />
          </div>
          <Field name="email" label="อีเมล" type="email" autoComplete="email" required />
          <div className="field-grid">
            <Field
              name="password"
              label="รหัสผ่าน"
              type="password"
              autoComplete="new-password"
              required
              hint="อย่างน้อย 10 ตัว มีตัวอักษรและตัวเลข"
            />
            <Field name="passwordConfirm" label="ยืนยันรหัสผ่าน" type="password" autoComplete="new-password" required />
          </div>
          <Check name="consent" label="ยินยอมให้คณะจัดเก็บข้อมูลบัญชีนี้เพื่อการติดต่อและแจ้งข่าวสารแก่นักศึกษา" />
        </ActionForm>
        <div className="auth-links">
          <span>
            จบการศึกษาแล้ว? <Link href="/register">สมัครเป็นศิษย์เก่า</Link>
          </span>
          <Link href="/login">มีบัญชีแล้ว — เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
