import Link from "next/link";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { MOD_STATUS_LABEL, POST_VISIBILITY_LABEL, type ModStatus, type PostVisibility } from "@/lib/server/posts";
import { formatThaiDateTime } from "@/lib/server/format-server";
import { declineTagAction } from "./actions";

export const metadata = { title: "ข่าวของฉัน" };

const SAVED: Record<string, string> = {
  draft: "บันทึกฉบับร่างแล้ว",
  submitted: "ส่งข่าวให้ผู้ตรวจสอบแล้ว จะแจ้งผลทางการแจ้งเตือน",
  published: "เผยแพร่ข่าวแล้ว",
  deleted: "ลบข่าวแล้ว",
  untagged: "นำชื่อของคุณออกจากข่าวนั้นแล้ว",
};

const PILL: Record<ModStatus, string> = {
  pending: "pending",
  approved: "verified",
  changes_requested: "pending",
  rejected: "rejected",
  hidden: "rejected",
};

export default async function MyPostsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const acc = await requireMember({ alumni: true });
  const { saved } = await searchParams;
  const verified = acc.claimStatus === "verified";

  const [posts, taggedIn] = await Promise.all([
    query<{
      id: number; title: string; type: string; visibility: PostVisibility; moderation_status: ModStatus;
      moderation_note: string | null; is_draft: boolean; updated_at: Date; published_at: Date | null;
      congrats: string; comments: string;
    }>(
      `SELECT p.id, p.title, p.type::text AS type, p.visibility::text AS visibility, p.moderation_status::text AS moderation_status,
              p.moderation_note, p.is_draft, p.updated_at, p.published_at,
              (SELECT count(*) FROM alumni_post_reaction r WHERE r.post_id = p.id) AS congrats,
              (SELECT count(*) FROM alumni_post_comment c WHERE c.post_id = p.id AND c.moderation_status = 'approved') AS comments
       FROM alumni_post p WHERE p.author_id = $1 ORDER BY p.updated_at DESC`,
      [acc.alumniId],
    ),
    query<{ id: number; title: string; author: string }>(
      `SELECT p.id, p.title, au.first_name_th || ' ' || au.last_name_th AS author
       FROM alumni_post_tag t JOIN alumni_post p ON p.id = t.post_id JOIN alumni au ON au.id = p.author_id
       WHERE t.alumni_id = $1 AND NOT t.declined AND p.moderation_status = 'approved' AND NOT p.is_draft
       ORDER BY p.published_at DESC`,
      [acc.alumniId],
    ),
  ]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ข่าวของฉัน</h1>
          <p>ข่าวที่คุณส่ง และข่าวที่มีคนแท็กคุณ</p>
        </div>
        {verified ? <Link href="/me/posts/new" className="btn btn-primary">+ ส่งข่าว</Link> : null}
      </div>

      {saved && SAVED[saved] ? <p className="flash flash-ok" role="status">{SAVED[saved]}</p> : null}
      {!verified ? (
        <p className="flash flash-warn" role="status">ส่งข่าวได้หลังเจ้าหน้าที่ยืนยันตัวตนของคุณแล้ว</p>
      ) : null}

      <section className="admin-card">
        <h2>ข่าวที่ฉันส่ง</h2>
        {posts.length === 0 ? (
          <p className="muted">ยังไม่มีข่าว</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th scope="col">หัวข้อ</th><th scope="col">สถานะ</th><th scope="col">ใครเห็น</th><th scope="col" className="num">👏 / 💬</th><th scope="col">แก้ไขล่าสุด</th></tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/me/posts/${p.id}`}><strong>{p.title}</strong></Link>
                      <div className="small muted">{p.type}</div>
                      {p.moderation_note && p.moderation_status !== "approved" ? (
                        <div className="small">ผู้ตรวจสอบ: {p.moderation_note}</div>
                      ) : null}
                    </td>
                    <td>
                      {p.is_draft ? (
                        <span className="pill">ฉบับร่าง</span>
                      ) : (
                        <span className={`pill pill-${PILL[p.moderation_status]}`}>{MOD_STATUS_LABEL[p.moderation_status]}</span>
                      )}
                      {p.moderation_status === "approved" && !p.is_draft ? (
                        <div className="small"><Link href={`/alumni-news/${p.id}`}>ดูข่าว</Link></div>
                      ) : null}
                    </td>
                    <td className="small">{POST_VISIBILITY_LABEL[p.visibility]}</td>
                    <td className="num">{p.congrats} / {p.comments}</td>
                    <td className="small muted">{formatThaiDateTime(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card">
        <h2>ข่าวที่แท็กฉัน</h2>
        {taggedIn.length === 0 ? (
          <p className="muted">ยังไม่มีใครแท็กคุณ</p>
        ) : (
          <ul className="list-plain">
            {taggedIn.map((t) => (
              <li key={t.id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                <span>
                  <Link href={`/alumni-news/${t.id}`}>{t.title}</Link> <span className="small muted">โดย {t.author}</span>
                </span>
                <form action={declineTagAction}>
                  <input type="hidden" name="postId" value={t.id} />
                  <button type="submit" className="link-danger">ปฏิเสธการแท็ก</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
