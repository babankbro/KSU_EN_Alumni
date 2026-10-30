import Link from "next/link";
import { formatNumber } from "@/lib/format";

/**
 * Horizontal bars for "how many members per group". Bars, not a pie: the
 * groups are compared by length, and a table-like layout keeps the exact
 * numbers readable for staff who will quote them in QA reports.
 */
export default function CountBars({
  rows,
}: {
  rows: { label: string; value: number; href?: string }[];
}) {
  if (rows.length === 0) return <p className="muted">ยังไม่มีข้อมูล</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <span>{r.href ? <Link href={r.href}>{r.label}</Link> : r.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ display: "block", width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-num">{formatNumber(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
