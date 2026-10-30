"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
  icon: string;
  count?: number;
}

export default function AdminNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="เมนูระบบจัดการ">
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            <span aria-hidden="true">{i.icon}</span>
            {i.label}
            {i.count ? (
              <span className="nav-count">
                {i.count}
                <span className="sr-only"> รายการรอดำเนินการ</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
