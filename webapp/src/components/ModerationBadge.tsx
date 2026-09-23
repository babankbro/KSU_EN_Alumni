import type { ModerationStatus } from "@/lib/types";

/** FR-ANEWS-08/09 — readers can see that alumni-submitted news was reviewed. */
export default function ModerationBadge({ status }: { status: ModerationStatus }) {
  if (status === "approved") {
    return <span className="mod-badge mod-approved">✓ ตรวจสอบแล้ว</span>;
  }
  if (status === "pending") {
    return <span className="mod-badge mod-pending">⏳ รอตรวจสอบ</span>;
  }
  if (status === "changes_requested") {
    return <span className="mod-badge mod-pending">✎ ขอให้แก้ไข</span>;
  }
  return null;
}
