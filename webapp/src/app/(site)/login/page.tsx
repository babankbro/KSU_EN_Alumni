import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMemberAccount } from "@/lib/server/member-auth";
import { lineLoginEnabled } from "@/lib/server/line";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { memberLoginAction } from "../member-actions";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

const LINE_MSG: Record<string, string> = {
  unlinked: "บัญชี LINE นี้ยังไม่ได้เชื่อมกับบัญชีศิษย์เก่า — เข้าสู่ระบบด้วยอีเมลก่อน แล้วเชื่อม LINE ที่หน้าตั้งค่า",
  failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่",
  disabled: "ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย LINE",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; line?: string }>;
}) {
  const sp = await searchParams;
  if (await getMemberAccount()) redirect("/me");

  return (
    <div className="wrap auth-wrap">
      <div className="auth-card">
        <h1>เข้าสู่ระบบ</h1>
        <p className="muted small">สำหรับศิษย์เก่าและนักศึกษาคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม</p>

        {sp.reset ? (
          <p className="flash flash-ok" role="status">ตั้งรหัสผ่านใหม่แล้ว เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย</p>
        ) : null}
        {sp.line && LINE_MSG[sp.line] ? (
          <p className="flash flash-warn" role="alert">{LINE_MSG[sp.line]}</p>
        ) : null}

        <ActionForm action={memberLoginAction} submitLabel="เข้าสู่ระบบ" pendingLabel="กำลังตรวจสอบ…">
          <input type="hidden" name="next" value={sp.next ?? "/me"} />
          <Field name="email" label="อีเมล" type="email" autoComplete="username" required />
          <Field name="password" label="รหัสผ่าน" type="password" autoComplete="current-password" required />
        </ActionForm>

        {lineLoginEnabled() ? (
          <>
            <div className="divider">หรือ</div>
            <a href="/api/auth/line/start" className="btn btn-line">
              เข้าสู่ระบบด้วย LINE
            </a>
          </>
        ) : null}

        <div className="auth-links">
          <Link href="/forgot-password">ลืมรหัสผ่าน?</Link>
          <span>
            ศิษย์เก่ายังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก / Claim โปรไฟล์</Link>
          </span>
          <span>
            นักศึกษาปัจจุบัน? <Link href="/signup/student">สร้างบัญชีนักศึกษา</Link>
          </span>
          <span className="small muted">
            เจ้าหน้าที่ใช้ <Link href="/admin/login">ระบบจัดการ</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
