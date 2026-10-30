import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { logoutAction } from "../actions";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  const [pending] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM alumni WHERE claim_status = 'pending'`,
  ).catch(() => [{ n: "0" }]);

  const items = [
    { href: "/admin", label: "ภาพรวม", icon: "▦" },
    // Member data is personal data: admins only (FR-ADM-18).
    ...(session.role === "admin"
      ? [{ href: "/admin/members", label: "สมาชิก", icon: "👥", count: Number(pending?.n ?? 0) }]
      : []),
    { href: "/admin/news", label: "ข่าวประชาสัมพันธ์", icon: "📰" },
    { href: "/admin/content", label: "ข้อมูลและรูปภาพเว็บ", icon: "🖼" },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link href="/admin" className="admin-brand">
          <span className="brand-mark" aria-hidden="true">KSU</span>
          <span>
            ระบบจัดการ
            <small>ศิษย์เก่าวิศวกรรมศาสตร์</small>
          </span>
        </Link>
        <AdminNav items={items} />
        <div className="admin-user">
          <strong>{session.displayName}</strong>
          <span className="role">{session.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้แก้ไขเนื้อหา"}</span>
          <div className="small muted" style={{ color: "rgba(255,255,255,.6)" }}>{session.email}</div>
          <form action={logoutAction}>
            <button type="submit">ออกจากระบบ</button>
          </form>
          <p className="small" style={{ margin: "10px 0 0" }}>
            <Link href="/" style={{ color: "rgba(255,255,255,.75)" }}>← ไปหน้าเว็บไซต์</Link>
          </p>
        </div>
      </aside>
      <main className="admin-main" id="main">
        {children}
      </main>
    </div>
  );
}
