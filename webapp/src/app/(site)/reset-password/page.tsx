import type { Metadata } from "next";
import Link from "next/link";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { resetPasswordAction } from "../member-actions";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="wrap auth-wrap">
      <div className="auth-card">
        <h1>ตั้งรหัสผ่านใหม่</h1>
        {!token ? (
          <p className="flash flash-error">
            ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่ที่ <Link href="/forgot-password">ลืมรหัสผ่าน</Link>
          </p>
        ) : (
          <ActionForm action={resetPasswordAction} submitLabel="ตั้งรหัสผ่านใหม่">
            <input type="hidden" name="token" value={token} />
            <Field
              name="password"
              label="รหัสผ่านใหม่"
              type="password"
              autoComplete="new-password"
              required
              hint="อย่างน้อย 10 ตัวอักษร มีทั้งตัวอักษรและตัวเลข"
            />
            <Field name="passwordConfirm" label="ยืนยันรหัสผ่านใหม่" type="password" autoComplete="new-password" required />
          </ActionForm>
        )}
        <p className="small muted" style={{ marginTop: 16 }}>
          การตั้งรหัสผ่านใหม่จะออกจากระบบทุกอุปกรณ์ที่เคยเข้าไว้
        </p>
      </div>
    </div>
  );
}
