import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server/auth";
import LoginForm from "@/components/admin/LoginForm";
import BrandMark from "@/components/BrandMark";

export const metadata = { title: "เข้าสู่ระบบเจ้าหน้าที่" };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");

  return (
    <main className="login-page" id="main">
      <div className="login-card">
        <BrandMark />
        <h1>ระบบจัดการศิษย์เก่า</h1>
        <p className="muted small">สำหรับเจ้าหน้าที่คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรมเท่านั้น</p>
        <LoginForm />
      </div>
    </main>
  );
}
