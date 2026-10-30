import Link from "next/link";
import Image from "next/image";
import type { NewsItem } from "@/lib/types";
import { formatThaiDate } from "@/lib/format";

type GridItem = NewsItem & { coverSrc?: string | null; isPinned?: boolean };

/** FR-NEWS-03 — official announcements from the faculty and the association. */
export default function NewsGrid({ items }: { items: GridItem[] }) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>ยังไม่มีข่าวประชาสัมพันธ์</p>
      </div>
    );
  }

  return (
    <div className="grid grid-3">
      {items.map((n) => (
        <article className="card" key={n.id}>
          {n.coverSrc ? (
            <div className="news-cover">
              <Image src={n.coverSrc} alt="" fill sizes="(max-width: 767px) 100vw, 33vw" />
            </div>
          ) : (
            <div className="portrait portrait-wide" aria-hidden="true">
              {n.category}
            </div>
          )}
          <div className="card-body">
            <span className="tag tag-outline">
              {n.isPinned ? "📌 " : ""}
              {formatThaiDate(n.publishedAt)}
            </span>
            <h3>{n.title}</h3>
            <p>{n.summary}</p>
            <div className="card-foot">
              {n.href.startsWith("/") ? (
                <Link href={n.href}>
                  อ่านต่อ<span className="sr-only">: {n.title}</span> →
                </Link>
              ) : (
                <a href={n.href}>อ่านต่อ →</a>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
