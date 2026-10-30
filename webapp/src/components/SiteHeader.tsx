"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Visual Design §5.2 — the specified menu.
 * "ข่าวสาร" covers both official announcements and the alumni-authored feed;
 * the feed lives at /alumni-news and is linked from the news page and footer.
 */
const NAV = [
  { href: "/", label: "หน้าแรก" },
  { href: "/directory", label: "ทำเนียบศิษย์เก่า" },
  { href: "/alumni-news", label: "ข่าวศิษย์เก่า" },
  { href: "/news", label: "ข่าวสาร" },
  { href: "/events", label: "กิจกรรม" },
  { href: "/jobs", label: "งานและฝึกงาน" },
  { href: "/about", label: "เกี่ยวกับเรา" },
];

export default function SiteHeader({
  member,
}: {
  /** Signed-in alumnus or student; null for visitors. */
  member?: { displayName: string; unread: number } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            KSU
          </span>
          <span className="brand-text">
            <strong>ศิษย์เก่าวิศวกรรมศาสตร์</strong>
            <span>KSU ENGINEERING ALUMNI</span>
          </span>
        </Link>

        <button
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="mainNav"
          onClick={() => setOpen((v) => !v)}
        >
          ☰ เมนู
        </button>

        <nav
          className={`main-nav${open ? " is-open" : ""}`}
          id="mainNav"
          aria-label="เมนูหลัก"
        >
          <ul>
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={active ? "is-active" : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="header-cta">
          {member ? (
            <>
              <Link href="/me/notifications" className="btn btn-outline btn-sm" aria-label={`การแจ้งเตือน ${member.unread} รายการที่ยังไม่อ่าน`}>
                🔔{member.unread ? ` ${member.unread}` : ""}
              </Link>
              <Link href="/me" className="btn btn-primary btn-sm">
                ของฉัน · {member.displayName.split(" ")[0]}
              </Link>
            </>
          ) : (
            <>
              <Link href="/register" className="btn btn-outline btn-sm">
                ลงทะเบียน / Claim โปรไฟล์
              </Link>
              <Link href="/login" className="btn btn-primary btn-sm">
                เข้าสู่ระบบ
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
