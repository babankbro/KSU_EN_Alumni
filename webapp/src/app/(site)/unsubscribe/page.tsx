import type { Metadata } from "next";
import Link from "next/link";
import { parseUnsubscribe, NOTIF_TYPES } from "@/lib/server/notify";
import { unsubscribeAction } from "../member-actions";

export const metadata: Metadata = { title: "ยกเลิกการรับอีเมล", robots: { index: false } };

/**
 * FR-NOTI-06 — reached from the link in every email. Asks for confirmation
 * instead of unsubscribing on GET: mail scanners prefetch links.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string; bad?: string }>;
}) {
  const { t, done, bad } = await searchParams;
  const parsed = t ? parseUnsubscribe(t) : null;
  const label = parsed ? (NOTIF_TYPES.find((n) => n.type === parsed.type)?.label ?? parsed.type) : null;

  return (
    <div className="wrap auth-wrap">
      <div className="auth-card">
        <h1>ยกเลิกการรับอีเมล</h1>
        {done ? (
          <p className="flash flash-ok" role="status">
            ยกเลิกเรียบร้อย คุณจะไม่ได้รับอีเมลประเภทนี้อีก (การแจ้งเตือนในเว็บยังคงอยู่)
          </p>
        ) : bad || !parsed ? (
          <p className="flash flash-error" role="alert">ลิงก์ไม่ถูกต้องหรือถูกแก้ไข</p>
        ) : (
          <form action={unsubscribeAction}>
            <input type="hidden" name="t" value={t} />
            <p>
              หยุดส่งอีเมลและ LINE ประเภท <strong>“{label}”</strong> ใช่หรือไม่?
            </p>
            <button type="submit" className="btn btn-primary">ยืนยันยกเลิกการรับ</button>
          </form>
        )}
        <div className="auth-links">
          <Link href="/me/notifications">ตั้งค่าการแจ้งเตือนทั้งหมด</Link>
        </div>
      </div>
    </div>
  );
}
