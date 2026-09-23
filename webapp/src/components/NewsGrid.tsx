import type { NewsItem } from "@/lib/types";
import { formatThaiDate } from "@/lib/format";

/** FR-NEWS-03 — official announcements from the faculty and the association. */
export default function NewsGrid({ items }: { items: NewsItem[] }) {
  return (
    <div className="grid grid-3">
      {items.map((n) => (
        <article className="card" key={n.id}>
          <div className="portrait portrait-wide" aria-hidden="true">
            {n.category}
          </div>
          <div className="card-body">
            <span className="tag tag-outline">{formatThaiDate(n.publishedAt)}</span>
            <h3>{n.title}</h3>
            <p>{n.summary}</p>
            <div className="card-foot">
              <a href={n.href}>อ่านต่อ →</a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
