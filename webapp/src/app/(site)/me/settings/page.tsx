import { requireMember } from "@/lib/server/member-auth";
import { lineLoginEnabled } from "@/lib/server/line";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { changePasswordAction, unlinkLineAction } from "../actions";

export const metadata = { title: "บัญชีและรหัสผ่าน" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const acc = await requireMember();
  const { line } = await searchParams;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>บัญชีและรหัสผ่าน</h1>
          <p>{acc.email} · {acc.role === "student" ? "นักศึกษา" : "ศิษย์เก่า"}</p>
        </div>
      </div>

      {line === "linked" ? <p className="flash flash-ok" role="status">เชื่อมบัญชี LINE แล้ว</p> : null}
      {line === "unlinked" ? <p className="flash flash-ok" role="status">ยกเลิกการเชื่อม LINE แล้ว</p> : null}

      <ActionForm action={changePasswordAction} submitLabel="เปลี่ยนรหัสผ่าน" resetOnSuccess>
        <h2 style={{ fontSize: 18, margin: 0 }}>เปลี่ยนรหัสผ่าน</h2>
        <Field name="current" label="รหัสผ่านปัจจุบัน" type="password" autoComplete="current-password" />
        <div className="field-grid">
          <Field name="password" label="รหัสผ่านใหม่" type="password" autoComplete="new-password" required hint="อย่างน้อย 10 ตัว มีตัวอักษรและตัวเลข" />
          <Field name="passwordConfirm" label="ยืนยันรหัสผ่านใหม่" type="password" autoComplete="new-password" required />
        </div>
      </ActionForm>

      <section className="admin-card">
        <h2>LINE</h2>
        {!lineLoginEnabled() ? (
          <p className="muted">คณะยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย LINE</p>
        ) : acc.lineLinked ? (
          <>
            <p>บัญชีนี้เชื่อมกับ LINE แล้ว — เข้าสู่ระบบด้วย LINE และรับแจ้งเตือนทาง LINE ได้</p>
            <form action={unlinkLineAction}><button type="submit" className="btn btn-outline">ยกเลิกการเชื่อม LINE</button></form>
          </>
        ) : (
          <>
            <p>เชื่อม LINE เพื่อเข้าสู่ระบบได้เร็วขึ้นและรับแจ้งเตือนทาง LINE</p>
            <a href="/api/auth/line/start" className="btn btn-line" style={{ width: "auto" }}>เชื่อมบัญชี LINE</a>
          </>
        )}
      </section>
    </>
  );
}
