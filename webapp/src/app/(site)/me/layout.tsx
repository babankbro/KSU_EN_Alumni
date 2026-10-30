import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import MeNav from "@/components/me/MeNav";
import { logoutAction } from "./actions";

export const metadata = { title: "ของฉัน", robots: { index: false } };

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const acc = await requireMember();
  const [r] = await query<{ unread: string; pending_mod: string }>(
    `SELECT (SELECT count(*) FROM notification WHERE account_id = $1 AND channel = 'in_app' AND read_at IS NULL) AS unread,
            (SELECT count(*) FROM alumni_post WHERE author_id = $2 AND moderation_status = 'changes_requested') AS pending_mod`,
    [acc.id, acc.alumniId],
  );

  const alumni = acc.role === "alumni";
  const items = [
    { href: "/me", label: "ภาพรวม" },
    ...(alumni
      ? [
          { href: "/me/profile", label: "ชื่อและรูป" },
          { href: "/me/career", label: "การทำงานและทักษะ" },
          { href: "/me/privacy", label: "ติดต่อและความเป็นส่วนตัว" },
          { href: "/me/posts", label: "ข่าวของฉัน", count: Number(r?.pending_mod ?? 0) },
          { href: "/me/activity", label: "กิจกรรม งาน บทความ" },
          { href: "/me/survey", label: "แบบสำรวจ" },
          { href: "/me/data", label: "ข้อมูลของฉัน (PDPA)" },
        ]
      : [{ href: "/jobs", label: "งานและฝึกงาน" }]),
    { href: "/me/notifications", label: "การแจ้งเตือน", count: Number(r?.unread ?? 0) },
    { href: "/me/settings", label: "บัญชีและรหัสผ่าน" },
  ];

  return (
    <section className="section">
      <div className="wrap me-layout">
        <MeNav items={items}>
          <form action={logoutAction}>
            <button type="submit">ออกจากระบบ</button>
          </form>
        </MeNav>
        <div>{children}</div>
      </div>
    </section>
  );
}
