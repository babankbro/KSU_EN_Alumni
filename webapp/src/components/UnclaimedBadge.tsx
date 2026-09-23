/**
 * Visual Design §6 — a record the alumnus has not claimed is marked grey and
 * shows no personal detail. It should not reach the public directory at all
 * (FR-DIR-07); this badge exists for the admin and preview surfaces.
 */
export default function UnclaimedBadge() {
  return <span className="badge badge-unclaimed">ยังไม่ Claim</span>;
}
