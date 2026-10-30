import Link from "next/link";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { formatThaiDateOnly, formatThaiDateTime } from "@/lib/server/format-server";
import { MOD_STATUS_LABEL, type ModStatus } from "@/lib/server/posts";

export const metadata = { title: "กิจกรรม งาน บทความ" };

const SAVED: Record<string, string> = {
  job: "ส่งประกาศงานให้ผู้ตรวจสอบแล้ว",
  kb: "ส่งบทความให้ผู้ตรวจสอบแล้ว",
  deleted: "ลบแล้ว",
  nomination: "ส่งการเสนอชื่อแล้ว ขอบคุณที่ร่วมเสนอชื่อ",
};
const PILL: Record<ModStatus, string> = { pending: "pending", approved: "verified", changes_requested: "pending", rejected: "rejected", hidden: "rejected" };
const NOMINATION: Record<string, string> = { submitted: "รอพิจารณา", shortlisted: "ผ่านเข้ารอบ", awarded: "ได้รับรางวัล", not_selected: "ไม่ได้รับเลือก" };

/** The member's own registrations, orders, job posts, articles and nominations. */
export default async function MyActivityPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const acc = await requireMember({ alumni: true });
  const { saved } = await searchParams;
  const verified = acc.claimStatus === "verified";

  const [events, jobs, articles, nominations] = await Promise.all([
    query<{ id: number; title: string; starts_at: Date; upcoming: boolean }>(
      `SELECT e.id, e.title, e.starts_at, coalesce(e.ends_at, e.starts_at) >= now() AS upcoming
       FROM event_registration r JOIN event e ON e.id = r.event_id
       WHERE r.alumni_id = $1 AND r.cancelled_at IS NULL ORDER BY e.starts_at DESC LIMIT 20`,
      [acc.alumniId],
    ),
    query<{ id: number; title: string; moderation_status: ModStatus; closes_at: Date | null; expired: boolean }>(
      `SELECT id, title, moderation_status::text AS moderation_status, closes_at,
              closes_at < (now() AT TIME ZONE 'Asia/Bangkok')::date AS expired
       FROM job_post WHERE posted_by = $1 ORDER BY created_at DESC`,
      [acc.alumniId],
    ),
    query<{ id: number; title: string; moderation_status: ModStatus; updated_at: Date }>(
      `SELECT id, title, moderation_status::text AS moderation_status, updated_at FROM kb_article WHERE author_id = $1 ORDER BY updated_at DESC`,
      [acc.alumniId],
    ),
    query<{ id: number; nominee_name: string; status: string; round: string; created_at: Date }>(
      `SELECT n.id, n.nominee_name, n.status, r.title AS round, n.created_at FROM award_nomination n JOIN award_round r ON r.id = n.round_id
       WHERE n.nominator_account_id = $1 ORDER BY n.created_at DESC`,
      [acc.id],
    ),
  ]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>กิจกรรม งาน บทความ</h1>
          <p>สิ่งที่คุณลงทะเบียน ประกาศ และเขียนไว้</p>
        </div>
      </div>
      {saved && SAVED[saved] ? <p className="flash flash-ok" role="status">{SAVED[saved]}</p> : null}
      {!verified ? <p className="flash flash-warn" role="status">ลงทะเบียนกิจกรรม ประกาศงาน และเขียนบทความได้หลังเจ้าหน้าที่ยืนยันตัวตนของคุณแล้ว</p> : null}

      <section className="admin-card">
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>กิจกรรมที่ลงทะเบียน</h2>
          <Link href="/events" className="btn btn-outline btn-sm">ดูปฏิทินกิจกรรม</Link>
        </div>
        {events.length ? (
          <ul className="list-plain">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`}>{e.title}</Link> <span className="small muted">· {formatThaiDateTime(e.starts_at)}{e.upcoming ? "" : " · ผ่านไปแล้ว"}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">ยังไม่ได้ลงทะเบียนกิจกรรม</p>}
      </section>

      <section className="admin-card">
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>ประกาศงานของฉัน</h2>
          {verified ? <Link href="/me/jobs/new" className="btn btn-primary btn-sm">+ ประกาศงาน</Link> : null}
        </div>
        {jobs.length ? (
          <ul className="list-plain">
            {jobs.map((j) => (
              <li key={j.id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                <span>
                  <Link href={`/me/jobs/${j.id}`}>{j.title}</Link>
                  <span className="small muted"> · ปิดรับ {j.closes_at ? formatThaiDateOnly(j.closes_at) : "—"}</span>
                </span>
                <span className={`pill pill-${j.expired ? "unclaimed" : PILL[j.moderation_status]}`}>
                  {j.expired ? "หมดอายุ" : MOD_STATUS_LABEL[j.moderation_status]}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">ยังไม่มีประกาศงาน</p>}
      </section>

      <section className="admin-card">
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>บทความของฉัน</h2>
          {verified ? <Link href="/me/kb/new" className="btn btn-primary btn-sm">+ เขียนบทความ</Link> : null}
        </div>
        {articles.length ? (
          <ul className="list-plain">
            {articles.map((k) => (
              <li key={k.id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                <Link href={`/me/kb/${k.id}`}>{k.title}</Link>
                <span className={`pill pill-${PILL[k.moderation_status]}`}>{MOD_STATUS_LABEL[k.moderation_status]}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">ยังไม่มีบทความ</p>}
      </section>

      <section className="admin-card">
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>การเสนอชื่อศิษย์เก่าดีเด่น</h2>
          <Link href="/awards" className="btn btn-outline btn-sm">ศิษย์เก่าดีเด่น</Link>
        </div>
        {nominations.length ? (
          <ul className="list-plain">
            {nominations.map((n) => (
              <li key={n.id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                <span>{n.nominee_name} <span className="small muted">· {n.round}</span></span>
                <span className="pill">{NOMINATION[n.status] ?? n.status}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">ยังไม่ได้เสนอชื่อ</p>}
      </section>
    </>
  );
}
