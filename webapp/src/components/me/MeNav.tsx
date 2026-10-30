"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MeNav({
  items,
  children,
}: {
  items: { href: string; label: string; count?: number }[];
  children?: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <nav className="me-nav" aria-label="เมนูของฉัน">
      {items.map((i) => {
        const active = i.href === "/me" ? path === "/me" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            <span>{i.label}</span>
            {i.count ? <span className="nav-count">{i.count}</span> : null}
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
