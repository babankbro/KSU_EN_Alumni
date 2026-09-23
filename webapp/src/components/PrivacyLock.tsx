/**
 * FR-DIR-06 — contact details are never rendered for anonymous visitors.
 * The placeholder states *why* the data is hidden instead of silently omitting it.
 */
export default function PrivacyLock({
  label = "เข้าสู่ระบบเพื่อดูข้อมูลติดต่อ",
}: {
  label?: string;
}) {
  return <p className="locked">🔒 {label}</p>;
}
