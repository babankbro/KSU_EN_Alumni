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
  { href: "/news", label: "ข่าวสาร" },
  { href: "/events", label: "กิจกรรม" },
  { href: "/jobs", label: "งานและฝึกงาน" },
  { href: "/about", label: "เกี่ยวกับเรา" },
];

export default function SiteHeader() {
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
          <a href="#" className="btn btn-outline btn-sm">
            ลงทะเบียน / Claim โปรไฟล์
          </a>
          <a href="#" className="btn btn-primary btn-sm">
            เข้าสู่ระบบ
          </a>
        </div>
      </div>
    </header>
  );
}
