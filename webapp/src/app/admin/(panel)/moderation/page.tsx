import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import { MEMORIAL, POST_VISIBILITY_LABEL, type PostVisibility } from "@/lib/server/posts";
import { thaiDate, thaiDateTime } from "@/lib/server/members";
import {
  dismissReportsAction,
  hideCommentAction,
  moderatePostAction,
  setTrustedPosterAction,
  togglePinAction,
} from "../../moderation-actions";
import { moderateJobAction, moderateKbAction } from "../../moderation-actions-content";

export const metadata = { title: "ตรวจสอบเนื้อหา" };

const TABS = [
  { key: "posts", label: "ข่าวศิษย์เก่ารอตรวจ" },
  { key: "jobs", label: "ประกาศงานรอตรวจ" },
  { key: "kb", label: "บทความรอตรวจ" },
  { key: "reports", label: "รายงานเนื้อหา" },
  { key: "published", label: "ข่าวที่เผยแพร่แล้ว" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const DONE: Record<string, [string, "ok" | "warn"]> = {
  approve: ["อนุมัติและเผยแพร่แล้ว — แจ้งผู้โพสต์แล้ว", "ok"],
  changes: ["ส่งคำขอให้แก้ไขแล้ว", "ok"],
  reject: ["บันทึกผลไม่อนุมัติแล้ว", "ok"],
  hide: ["ซ่อนเนื้อหาแล้ว และบันทึกเหตุผลลงประวัติ", "ok"],
  unhide: ["นำกลับมาแสดงแล้ว", "ok"],
  delete: ["ลบแล้ว และบันทึกเหตุผลลงประวัติ", "ok"],
  pin: ["ปักหมุดแล้ว", "ok"],
  unpin: ["เลิกปักหมุดแล้ว", "ok"],
  dismiss: ["ปิดรายงานโดยไม่ดำเนินการกับเนื้อหา", "ok"],
  trusted: ["ผู้โพสต์คนนี้เผยแพร่ได้ทันทีแล้ว (ยกเว้นข่าวไว้อาลัย)", "ok"],
  untrusted: ["ยกเลิกสิทธิ์เผยแพร่ทันทีแล้ว", "ok"],
  need_note: ["กรุณาระบุเหตุผล — ผู้โพสต์จะเห็นข้อความนี้", "warn"],
  need_memorial_check: ["ข่าวไว้อาลัยต้องยืนยันว่าตรวจสอบข้อเท็จจริงแล้วก่อนอนุมัติ", "warn"],
  missing: ["ไม่พบรายการนี้ อาจถูกจัดการไปแล้ว", "warn"],
  invalid: ["คำสั่งไม่ถูกต้อง", "warn"],
};

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ tab?: string; done?: string }> }) {
  const session = await requireAdmin(["admin", "editor"]);
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "posts";
  const done = sp.done ? DONE[sp.done] : undefined;
  const isAdmin = session.role === "admin";

  const [counts] = await query<{ posts: string; jobs: string; kb: string; reports: string }>(
    `SELECT (SELECT count(*) FROM alumni_post WHERE moderation_status = 'pending' AND NOT is_draft) AS posts,
            (SELECT count(*) FROM job_post WHERE moderation_status = 'pending') AS jobs,
            (SELECT count(*) FROM kb_article WHERE moderation_status = 'pending') AS kb,
            (SELECT count(DISTINCT (target_type, target_id)) FROM content_report WHERE status = 'open') AS reports`,
  );
  const count = (k: Tab) => (k === "published" ? 0 : Number(counts[k as keyof typeof counts] ?? 0));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ตรวจสอบเนื้อหา</h1>
          <p>คิวรวมของข่าวศิษย์เก่า ประกาศงาน บทความ และรายงานเนื้อหาไม่เหมาะสม</p>
        </div>
      </div>

      <nav className="admin-tabs" aria-label="ประเภทคิว">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/moderation?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>
            {t.label}
            {count(t.key) ? <span className="nav-count">{count(t.key)}</span> : null}
          </Link>
        ))}
      </nav>

      {done ? <p className={`flash flash-${done[1]}`} role={done[1] === "ok" ? "status" : "alert"}>{done[0]}</p> : null}

      {tab === "posts" ? <PendingPosts isAdmin={isAdmin} /> : null}
      {tab === "published" ? <PublishedPosts /> : null}
      {tab === "reports" ? <Reports /> : null}
      {tab === "jobs" ? <PendingJobs /> : null}
      {tab === "kb" ? <PendingKb /> : null}
    </>
  );
}

/* ---------------- posts ---------------- */

async function PendingPosts({ isAdmin }: { isAdmin: boolean }) {
  const posts = await query<{
    id: number; type: string; title: string; body: string; visibility: PostVisibility; image_file_id: string | null;
    submitted_at: Date | null; created_at: Date; author_id: string; author: string; admission_year: number; program: string;
    trusted: boolean | null; approved_before: string; tags: string[] | null;
  }>(
    `SELECT p.id, p.type::text AS type, p.title, p.body, p.visibility::text AS visibility, p.image_file_id,
            p.submitted_at, p.created_at, au.id AS author_id,
            au.title_th || au.first_name_th || ' ' || au.last_name_th AS author, au.admission_year, pr.name_th AS program,
            (SELECT is_trusted_poster FROM account WHERE alumni_id = au.id LIMIT 1) AS trusted,
            (SELECT count(*) FROM alumni_post x WHERE x.author_id = au.id AND x.moderation_status = 'approved') AS approved_before,
            (SELECT array_agg(a.first_name_th || ' ' || a.last_name_th) FROM alumni_post_tag t JOIN alumni a ON a.id = t.alumni_id
              WHERE t.post_id = p.id AND NOT t.declined) AS tags
     FROM alumni_post p JOIN alumni au ON au.id = p.author_id JOIN program_resolved pr ON pr.id = au.program_id
     WHERE p.moderation_status = 'pending' AND NOT p.is_draft
     ORDER BY coalesce(p.submitted_at, p.created_at)`,
  );
  if (posts.length === 0) return <p className="admin-card muted">ไม่มีข่าวรอตรวจสอบ 🎉</p>;

  return (
    <>
      {posts.map((p) => {
        const memorial = p.type === MEMORIAL;
        return (
          <section key={p.id} className={`admin-card mod-item${memorial ? " mod-memorial" : ""}`} aria-labelledby={`p${p.id}`}>
            <p className="small muted" style={{ margin: 0 }}>
              <span className="pill">{p.type}</span> · {POST_VISIBILITY_LABEL[p.visibility]} · ส่งเมื่อ {thaiDateTime(p.submitted_at ?? p.created_at)}
            </p>
            <h2 id={`p${p.id}`} style={{ margin: "8px 0 4px" }}>{p.title}</h2>
            <p className="small" style={{ margin: 0 }}>
              โดย {isAdmin ? <Link href={`/admin/members/${p.author_id}`}>{p.author}</Link> : p.author} · รุ่น {p.admission_year} · {p.program} ·
              เคยผ่านการตรวจ {p.approved_before} ข่าว{p.trusted ? " · เผยแพร่ทันทีได้" : ""}
            </p>
            {p.image_file_id ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(p.image_file_id)} alt="รูปประกอบข่าว" className="post-image-preview" />
            ) : null}
            <p className="mod-body">{p.body}</p>
            {p.tags?.length ? <p className="small">แท็ก: {p.tags.join(", ")}</p> : null}

            <form action={moderatePostAction} className="mod-form">
              <input type="hidden" name="recordId" value={p.id} />
              <input type="hidden" name="tab" value="posts" />
              {memorial ? (
                <div className="flash flash-warn">
                  <strong>ข่าวไว้อาลัยต้องตรวจสอบเสมอ</strong> — ยืนยันข้อเท็จจริงกับครอบครัวหรือแหล่งที่เชื่อถือได้ก่อน
                  การอนุมัติข่าวนี้<strong>ไม่</strong>เปลี่ยนสถานะระเบียนศิษย์เก่าโดยอัตโนมัติ
                  <label className="check-row" style={{ marginTop: 8 }}>
                    <input type="checkbox" name="memorialChecked" /> <span>ตรวจสอบข้อเท็จจริงแล้ว</span>
                  </label>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor={`note${p.id}`}>เหตุผล / ข้อความถึงผู้โพสต์ (จำเป็นเมื่อขอให้แก้ไขหรือไม่อนุมัติ)</label>
                <textarea id={`note${p.id}`} name="note" rows={2} maxLength={1000} />
              </div>
              <div className="review-actions">
                <button type="submit" name="decision" value="approve" className="btn btn-primary">✓ อนุมัติและเผยแพร่</button>
                <button type="submit" name="decision" value="changes" className="btn btn-outline">ขอให้แก้ไข</button>
                <button type="submit" name="decision" value="reject" className="btn btn-danger">ไม่อนุมัติ</button>
              </div>
            </form>
            {isAdmin ? (
              <form action={setTrustedPosterAction} className="small" style={{ marginTop: 8 }}>
                <input type="hidden" name="alumniId" value={p.author_id} />
                <input type="hidden" name="tab" value="posts" />
                <input type="hidden" name="trusted" value={p.trusted ? "0" : "1"} />
                <button type="submit" className="link-button">
                  {p.trusted ? "ยกเลิกสิทธิ์เผยแพร่ทันทีของผู้โพสต์นี้" : "ให้ผู้โพสต์นี้เผยแพร่ได้ทันทีในครั้งต่อไป (ยกเว้นข่าวไว้อาลัย)"}
                </button>
              </form>
            ) : null}
          </section>
        );
      })}
    </>
  );
}

async function PublishedPosts() {
  const posts = await query<{
    id: number; title: string; type: string; is_pinned: boolean; published_at: Date; author: string;
    moderation_status: string; visibility: PostVisibility;
  }>(
    `SELECT p.id, p.title, p.type::text AS type, p.is_pinned, p.published_at, p.moderation_status::text AS moderation_status,
            p.visibility::text AS visibility, au.first_name_th || ' ' || au.last_name_th AS author
     FROM alumni_post p JOIN alumni au ON au.id = p.author_id
     WHERE p.moderation_status IN ('approved', 'hidden') AND NOT p.is_draft
     ORDER BY p.is_pinned DESC, p.published_at DESC NULLS LAST LIMIT 100`,
  );
  if (posts.length === 0) return <p className="admin-card muted">ยังไม่มีข่าวที่เผยแพร่</p>;
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr><th scope="col">ข่าว</th><th scope="col">สถานะ</th><th scope="col">ปักหมุด</th><th scope="col">ซ่อน / ลบ (ระบุเหตุผล)</th></tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id}>
              <td>
                {p.moderation_status === "approved" ? <Link href={`/alumni-news/${p.id}`}><strong>{p.title}</strong></Link> : <strong>{p.title}</strong>}
                <div className="small muted">{p.author} · {p.type} · {POST_VISIBILITY_LABEL[p.visibility]} · {thaiDateTime(p.published_at)}</div>
              </td>
              <td>
                <span className={`pill pill-${p.moderation_status === "approved" ? "verified" : "rejected"}`}>
                  {p.moderation_status === "approved" ? "แสดงอยู่" : "ถูกซ่อน"}
                </span>
              </td>
              <td>
                {p.moderation_status === "approved" ? (
                  <form action={togglePinAction}>
                    <input type="hidden" name="recordId" value={p.id} />
                    <input type="hidden" name="tab" value="published" />
                    <button type="submit" className="btn btn-outline btn-sm">{p.is_pinned ? "📌 เลิกปักหมุด" : "ปักหมุด"}</button>
                  </form>
                ) : "—"}
              </td>
              <td>
                <form action={moderatePostAction} className="inline-actions">
                  <input type="hidden" name="recordId" value={p.id} />
                  <input type="hidden" name="tab" value="published" />
                  {p.moderation_status === "approved" ? (
                    <>
                      <label className="sr-only" htmlFor={`hn${p.id}`}>เหตุผล</label>
                      <input id={`hn${p.id}`} name="note" placeholder="เหตุผล" maxLength={1000} />
                      <button type="submit" name="decision" value="hide" className="btn btn-outline btn-sm">ซ่อน</button>
                      <button type="submit" name="decision" value="delete" className="btn btn-danger btn-sm">ลบ</button>
                    </>
                  ) : (
                    <button type="submit" name="decision" value="unhide" className="btn btn-outline btn-sm">นำกลับมาแสดง</button>
                  )}
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- reports ---------------- */

async function Reports() {
  const groups = await query<{
    target_type: string; target_id: number; reasons: string[]; n: string; first_at: Date;
    post_id: number | null; title: string | null; body: string | null;
  }>(
    `SELECT r.target_type, r.target_id, array_agg(r.reason ORDER BY r.created_at) AS reasons, count(*) AS n, min(r.created_at) AS first_at,
            CASE r.target_type WHEN 'post' THEN r.target_id WHEN 'comment' THEN (SELECT post_id FROM alumni_post_comment WHERE id = r.target_id) END AS post_id,
            CASE r.target_type
              WHEN 'post' THEN (SELECT title FROM alumni_post WHERE id = r.target_id)
              WHEN 'job' THEN (SELECT title FROM job_post WHERE id = r.target_id)
              WHEN 'kb' THEN (SELECT title FROM kb_article WHERE id = r.target_id)
              WHEN 'comment' THEN (SELECT p.title FROM alumni_post_comment c JOIN alumni_post p ON p.id = c.post_id WHERE c.id = r.target_id)
            END AS title,
            CASE r.target_type WHEN 'comment' THEN (SELECT body FROM alumni_post_comment WHERE id = r.target_id) END AS body
     FROM content_report r WHERE r.status = 'open'
     GROUP BY r.target_type, r.target_id ORDER BY count(*) DESC, min(r.created_at)`,
  );
  if (groups.length === 0) return <p className="admin-card muted">ไม่มีรายงานค้าง</p>;
  const TYPE: Record<string, string> = { post: "ข่าวศิษย์เก่า", comment: "ความคิดเห็น", job: "ประกาศงาน", kb: "บทความ" };

  return (
    <>
      {groups.map((g) => (
        <section key={`${g.target_type}:${g.target_id}`} className="admin-card mod-item">
          <p className="small muted" style={{ margin: 0 }}>
            <span className="pill pill-pending">{TYPE[g.target_type]}</span> · รายงาน {g.n} ครั้ง · ครั้งแรก {thaiDateTime(g.first_at)}
          </p>
          <h2 style={{ margin: "8px 0 4px", fontSize: 18 }}>
            {g.title ?? "(ถูกลบไปแล้ว)"}
            {g.post_id && g.title ? <> · <Link className="small" href={`/alumni-news/${g.post_id}`}>เปิดดู</Link></> : null}
          </h2>
          {g.body ? <blockquote className="mod-body">{g.body}</blockquote> : null}
          <ul className="small">{g.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>

          <div className="inline-actions">
            {g.title ? (
              <form
                action={g.target_type === "comment" ? hideCommentAction : g.target_type === "post" ? moderatePostAction : g.target_type === "job" ? moderateJobAction : moderateKbAction}
                className="inline-actions"
              >
                <input type="hidden" name="recordId" value={g.target_id} />
                <input type="hidden" name="tab" value="reports" />
                <input type="hidden" name="decision" value="hide" />
                <label className="sr-only" htmlFor={`r${g.target_type}${g.target_id}`}>เหตุผลที่ซ่อน</label>
                <input id={`r${g.target_type}${g.target_id}`} name="note" placeholder="เหตุผลที่ซ่อน (บันทึกลงประวัติ)" maxLength={1000} required />
                <button type="submit" className="btn btn-danger btn-sm">ซ่อนเนื้อหา</button>
              </form>
            ) : null}
            <form action={dismissReportsAction}>
              <input type="hidden" name="targetType" value={g.target_type} />
              <input type="hidden" name="targetId" value={g.target_id} />
              <input type="hidden" name="tab" value="reports" />
              <button type="submit" className="btn btn-outline btn-sm">ไม่พบการละเมิด — ปิดรายงาน</button>
            </form>
          </div>
        </section>
      ))}
    </>
  );
}

/* ---------------- jobs and articles ---------------- */

async function PendingJobs() {
  const jobs = await query<{
    id: number; title: string; organization: string; type: string; province: string | null; description: string | null;
    closes_at: Date | null; created_at: Date; poster: string | null;
  }>(
    `SELECT j.id, j.title, j.organization, j.employment_type::text AS type, coalesce(j.province, j.location) AS province,
            j.description, j.closes_at, j.created_at,
            a.first_name_th || ' ' || a.last_name_th AS poster
     FROM job_post j LEFT JOIN alumni a ON a.id = j.posted_by
     WHERE j.moderation_status = 'pending' ORDER BY j.created_at`,
  );
  if (jobs.length === 0) return <p className="admin-card muted">ไม่มีประกาศงานรอตรวจสอบ</p>;
  return (
    <>
      {jobs.map((j) => (
        <section key={j.id} className="admin-card mod-item">
          <p className="small muted" style={{ margin: 0 }}>
            <span className="pill">{j.type}</span> · {j.province ?? "ไม่ระบุจังหวัด"} · ปิดรับ {thaiDate(j.closes_at)} · ส่งเมื่อ {thaiDateTime(j.created_at)}
          </p>
          <h2 style={{ margin: "8px 0 4px" }}>{j.title} — {j.organization}</h2>
          <p className="small">ประกาศโดย {j.poster ?? "เจ้าหน้าที่"}</p>
          {j.description ? <p className="mod-body">{j.description}</p> : null}
          <ModForm action={moderateJobAction} id={j.id} tab="jobs" />
        </section>
      ))}
    </>
  );
}

async function PendingKb() {
  const rows = await query<{ id: number; title: string; summary: string | null; body: string; category: string; author: string; created_at: Date }>(
    `SELECT k.id, k.title, k.summary, k.body, k.category, a.first_name_th || ' ' || a.last_name_th AS author, k.created_at
     FROM kb_article k JOIN alumni a ON a.id = k.author_id WHERE k.moderation_status = 'pending' ORDER BY k.created_at`,
  );
  if (rows.length === 0) return <p className="admin-card muted">ไม่มีบทความรอตรวจสอบ</p>;
  return (
    <>
      {rows.map((k) => (
        <section key={k.id} className="admin-card mod-item">
          <p className="small muted" style={{ margin: 0 }}><span className="pill">{k.category}</span> · โดย {k.author} · {thaiDateTime(k.created_at)}</p>
          <h2 style={{ margin: "8px 0 4px" }}>{k.title}</h2>
          {k.summary ? <p><em>{k.summary}</em></p> : null}
          <p className="mod-body">{k.body}</p>
          <ModForm action={moderateKbAction} id={k.id} tab="kb" />
        </section>
      ))}
    </>
  );
}

function ModForm({ action, id, tab }: { action: (fd: FormData) => Promise<void>; id: number; tab: string }) {
  return (
    <form action={action} className="mod-form">
      <input type="hidden" name="recordId" value={id} />
      <input type="hidden" name="tab" value={tab} />
      <div className="field">
        <label htmlFor={`${tab}n${id}`}>เหตุผล / ข้อความถึงผู้ส่ง (จำเป็นเมื่อขอให้แก้ไขหรือไม่อนุมัติ)</label>
        <textarea id={`${tab}n${id}`} name="note" rows={2} maxLength={1000} />
      </div>
      <div className="review-actions">
        <button type="submit" name="decision" value="approve" className="btn btn-primary">✓ อนุมัติ</button>
        <button type="submit" name="decision" value="changes" className="btn btn-outline">ขอให้แก้ไข</button>
        <button type="submit" name="decision" value="reject" className="btn btn-danger">ไม่อนุมัติ</button>
      </div>
    </form>
  );
}
