import Link from "next/link";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { missingItems } from "@/lib/server/profile";
import { formatThaiDateOnly, formatThaiDateTime } from "@/lib/server/format-server";
import { confirmStillCorrectAction } from "./actions";

const NEED: Record<string, string> = {
  alumni: "เมนูนี้สำหรับบัญชีศิษย์เก่าเท่านั้น",
  verified: "ใช้ได้หลังเจ้าหน้าที่ยืนยันตัวตนของคุณแล้ว",
};

export default async function MePage({ searchParams }: { searchParams: Promise<{ need?: string; confirmed?: string }> }) {
  const acc = await requireMember();
  const sp = await searchParams;

  const [profile] = acc.alumniId
    ? await query<{ completeness_score: number; profile_updated_at: Date; stale: boolean; program: string; admission_year: number }>(
        `SELECT a.completeness_score, a.profile_updated_at, a.profile_updated_at < now() - interval '12 months' AS stale,
                p.current_name_th AS program, a.admission_year
         FROM alumni a JOIN program_resolved p ON p.id = a.program_id WHERE a.id = $1`,
        [acc.alumniId],
      )
    : [];
  const missing = acc.alumniId ? await missingItems(acc.alumniId) : [];
  const notes = await query<{ title: string; link: string | null; created_at: Date; read_at: Date | null }>(
    `SELECT title, link, created_at, read_at FROM notification
     WHERE account_id = $1 AND channel = 'in_app' ORDER BY created_at DESC LIMIT 5`,
    [acc.id],
  );
  const [review] = acc.alumniId
    ? await query<{ review_note: string | null; status: string }>(
        `SELECT review_note, status::text FROM registration_request WHERE alumni_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [acc.alumniId],
      )
    : [];

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>สวัสดี {acc.displayName}</h1>
          <p>
            {acc.role === "student"
              ? "บัญชีนักศึกษาปัจจุบัน"
              : profile
                ? `${profile.program} · รุ่น ${profile.admission_year}`
                : "บัญชีศิษย์เก่า"}
          </p>
        </div>
      </div>

      {sp.need && NEED[sp.need] ? <p className="flash flash-warn" role="alert">{NEED[sp.need]}</p> : null}
      {sp.confirmed ? <p className="flash flash-ok" role="status">ขอบคุณที่ยืนยัน — ข้อมูลของคุณแสดงเป็น “ข้อมูลเป็นปัจจุบัน” แล้ว</p> : null}

      {acc.role === "alumni" ? (
        acc.claimStatus === "verified" ? null : (
          <div className={`status-banner ${acc.claimStatus === "pending" ? "pending" : ""}`} role="status">
            <strong>
              {acc.claimStatus === "pending"
                ? "ใบสมัครของคุณรอเจ้าหน้าที่ตรวจสอบ"
                : acc.claimStatus === "rejected"
                  ? "ใบสมัครไม่ผ่านการตรวจสอบ"
                  : "บัญชียังไม่ได้เชื่อมกับระเบียนศิษย์เก่า"}
            </strong>
            <p style={{ margin: "4px 0 0" }}>
              {acc.claimStatus === "pending"
                ? "ระหว่างนี้คุณแก้ไขข้อมูลโปรไฟล์ได้ตามปกติ — การโพสต์ข่าว การดูข้อมูลติดต่อเพื่อนในทำเนียบ และการลงทะเบียนกิจกรรมจะเปิดหลังได้รับการยืนยัน"
                : acc.claimStatus === "rejected"
                  ? `กรุณาติดต่องานศิษย์เก่าสัมพันธ์${review?.review_note ? ` (หมายเหตุ: ${review.review_note})` : ""}`
                  : "ติดต่องานศิษย์เก่าสัมพันธ์เพื่อเชื่อมบัญชี"}
            </p>
          </div>
        )
      ) : null}

      {profile ? (
        <div className="admin-grid-2">
          <section className="admin-card">
            <h2>ความสมบูรณ์ของโปรไฟล์</h2>
            <div className="completeness">
              <div className="completeness-bar" role="progressbar" aria-valuenow={profile.completeness_score} aria-valuemin={0} aria-valuemax={100} aria-label="ความสมบูรณ์ของโปรไฟล์">
                <span style={{ width: `${profile.completeness_score}%` }} />
              </div>
              <p className="completeness-label">{profile.completeness_score}%</p>
            </div>
            {missing.length > 0 ? (
              <ul className="list-plain small">
                {missing.slice(0, 4).map((m) => (
                  <li key={m.label}><Link href={m.href}>+ {m.label}</Link></li>
                ))}
              </ul>
            ) : (
              <p className="small muted">โปรไฟล์ครบถ้วนแล้ว</p>
            )}
          </section>

          <section className={`admin-card${profile.stale ? " review-box" : ""}`}>
            <h2>ข้อมูลของฉันยังถูกต้องไหม?</h2>
            <p className="small">
              อัปเดตล่าสุด {formatThaiDateOnly(profile.profile_updated_at)}
              {profile.stale ? " — เกิน 12 เดือนแล้ว เพื่อนร่วมรุ่นจะเห็นป้าย “ควรอัปเดต”" : ""}
            </p>
            <form action={confirmStillCorrectAction}>
              <button type="submit" className="btn btn-primary">✓ ข้อมูลยังถูกต้อง</button>
            </form>
            <p className="small muted" style={{ marginTop: 8 }}>กดครั้งเดียว ไม่ต้องกรอกอะไรใหม่ (FR-PROF-06)</p>
          </section>
        </div>
      ) : null}

      <section className="admin-card">
        <h2>การแจ้งเตือนล่าสุด</h2>
        {notes.length === 0 ? (
          <p className="muted">ยังไม่มีการแจ้งเตือน</p>
        ) : (
          <ul className="list-plain">
            {notes.map((n, i) => (
              <li key={i} className={n.read_at ? undefined : "notif-unread"}>
                {n.link ? <Link href={n.link}>{n.title}</Link> : n.title}
                <div className="small muted">{formatThaiDateTime(n.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="small"><Link href="/me/notifications">ดูทั้งหมดและตั้งค่า →</Link></p>
      </section>
    </>
  );
}
