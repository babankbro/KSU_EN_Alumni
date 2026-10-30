import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { logoutAction } from "../actions";
import AdminNav from "@/components/admin/AdminNav";

const ROLE_LABEL = { admin: "ผู้ดูแลระบบ", editor: "ผู้แก้ไขเนื้อหา", faculty: "อาจารย์ / กรรมการ" } as const;

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  const [pending] = await query<{ n: string; queue: string; pdpa: string }>(
    `SELECT (SELECT count(*) FROM alumni WHERE claim_status = 'pending') AS n,
            (SELECT count(*) FROM alumni_post WHERE moderation_status = 'pending' AND NOT is_draft)
          + (SELECT count(*) FROM job_post WHERE moderation_status = 'pending')
          + (SELECT count(*) FROM kb_article WHERE moderation_status = 'pending')
          + (SELECT count(DISTINCT (target_type, target_id)) FROM content_report WHERE status = 'open') AS queue,
            (SELECT count(*) FROM pdpa_request WHERE status IN ('open', 'in_progress')) AS pdpa`,
  ).catch(() => [{ n: "0", queue: "0", pdpa: "0" }]);
  const role = session.role;

  const items = [
    { href: "/admin", label: "ภาพรวม", icon: "▦" },
    // Member data is personal data: admins only (FR-ADM-18).
    ...(session.role === "admin" || session.role === "faculty"
      ? [{ href: "/admin/members", label: "สมาชิก", icon: "👥", count: Number(pending?.n ?? 0) }]
      : []),
    ...(role === "admin" || role === "editor"
      ? [{ href: "/admin/moderation", label: "ตรวจสอบเนื้อหา", icon: "✓", count: Number(pending?.queue ?? 0) }]
      : []),
    ...(role === "admin" || role === "editor"
      ? [
          { href: "/admin/news", label: "ข่าวประชาสัมพันธ์", icon: "📰" },
          { href: "/admin/events", label: "กิจกรรม", icon: "📅" },
          { href: "/admin/gallery", label: "แกลเลอรี", icon: "📷" },
        ]
      : []),
    ...(role === "admin" || role === "faculty"
      ? [
          { href: "/admin/awards", label: "ศิษย์เก่าดีเด่น", icon: "🏅" },
          { href: "/admin/surveys", label: "แบบสำรวจ", icon: "📊" },
        ]
      : []),
    ...(role === "admin" || role === "editor" ? [{ href: "/admin/content", label: "ข้อมูลและรูปภาพเว็บ", icon: "🖼" }] : []),
    ...(role === "admin"
      ? [
          { href: "/admin/broadcast", label: "ส่งประกาศ", icon: "📣" },
          { href: "/admin/pdpa", label: "คำขอ PDPA", icon: "🔒", count: Number(pending?.pdpa ?? 0) },
          { href: "/admin/import", label: "นำเข้าข้อมูล", icon: "⬆" },
          { href: "/admin/duplicates", label: "ระเบียนซ้ำ", icon: "⧉" },
          { href: "/admin/reference", label: "ข้อมูลอ้างอิง", icon: "⚙" },
          { href: "/admin/staff", label: "บัญชีเจ้าหน้าที่", icon: "🔑" },
        ]
      : []),
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
          <span className="role">{ROLE_LABEL[role]}</span>
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
