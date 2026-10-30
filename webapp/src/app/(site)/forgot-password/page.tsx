import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { forgotPasswordAction } from "../member-actions";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน" };

export default function ForgotPasswordPage() {
  return (
    <div className="wrap auth-wrap">
      <div className="auth-card">
        <h1>ลืมรหัสผ่าน</h1>
        <p className="muted small">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ ลิงก์ใช้ได้ 1 ชั่วโมง</p>
        <ActionForm action={forgotPasswordAction} submitLabel="ส่งลิงก์ตั้งรหัสผ่าน" pendingLabel="กำลังส่ง…" resetOnSuccess>
          <Field name="email" label="อีเมล" type="email" autoComplete="email" required />
        </ActionForm>
        <div className="auth-links">
          <Link href="/login">← กลับไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
