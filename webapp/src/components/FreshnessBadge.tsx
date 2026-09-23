import { formatThaiDate, isStale } from "@/lib/format";

/**
 * FR-PROF-04 + Visual Design §6 (Badges).
 *
 * A profile confirmed within the last 12 months reads as current; anything
 * older is labelled rather than silently trusted.
 */
export default function FreshnessBadge({ updatedAt }: { updatedAt: string }) {
  const stale = isStale(updatedAt);
  return (
    <p className="freshness">
      <span className={stale ? "badge badge-stale" : "badge badge-fresh"}>
        {stale ? "ควรอัปเดต" : "ข้อมูลเป็นปัจจุบัน"}
      </span>
      <span className="updated-on">อัปเดตเมื่อ {formatThaiDate(updatedAt)}</span>
    </p>
  );
}
