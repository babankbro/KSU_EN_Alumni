import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { MOD_STATUS_LABEL, type ModStatus, type PostVisibility } from "@/lib/server/posts";
import PostEditor from "../PostEditor";
import { deletePostAction } from "../actions";

export const metadata = { title: "แก้ไขข่าว" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const acc = await requireMember({ alumni: true, verified: true });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [p] = await query<{
    id: number; type: string; title: string; body: string; visibility: PostVisibility; image_file_id: string | null;
    moderation_status: ModStatus; moderation_note: string | null; is_draft: boolean;
  }>(
    `SELECT id, type::text AS type, title, body, visibility::text AS visibility, image_file_id,
            moderation_status::text AS moderation_status, moderation_note, is_draft
     FROM alumni_post WHERE id = $1 AND author_id = $2`,
    [id, acc.alumniId],
  );
  if (!p) notFound();
  const tags = await query<{ id: string; name: string }>(
    `SELECT a.id, a.first_name_th || ' ' || a.last_name_th AS name
     FROM alumni_post_tag t JOIN alumni a ON a.id = t.alumni_id WHERE t.post_id = $1 AND NOT t.declined`,
    [id],
  );

  return (
    <>
      <p className="small"><Link href="/me/posts">← ข่าวของฉัน</Link></p>
      <div className="admin-head">
        <div>
          <h1>แก้ไขข่าว</h1>
          <p>สถานะ: {p.is_draft ? "ฉบับร่าง" : MOD_STATUS_LABEL[p.moderation_status]}</p>
        </div>
      </div>
      {p.moderation_note && ["changes_requested", "rejected", "hidden"].includes(p.moderation_status) ? (
        <p className="flash flash-warn" role="status">
          <strong>ความเห็นจากผู้ตรวจสอบ:</strong> {p.moderation_note}
        </p>
      ) : null}
      {p.moderation_status === "hidden" ? (
        <p className="muted">ข่าวนี้ถูกซ่อนโดยผู้ตรวจสอบ จึงแก้ไขไม่ได้ แต่ยังลบได้</p>
      ) : (
        <PostEditor
          trusted={acc.isTrustedPoster}
          post={{ id: p.id, type: p.type, title: p.title, body: p.body, visibility: p.visibility, imageFileId: p.image_file_id, tags }}
        />
      )}
      <form action={deletePostAction} className="admin-card danger-zone">
        <input type="hidden" name="recordId" value={p.id} />
        <h2>ลบข่าวนี้</h2>
        <p className="small muted">ลบแล้วกู้คืนไม่ได้ ความคิดเห็นและการแสดงความยินดีจะถูกลบไปด้วย</p>
        <button type="submit" className="btn btn-danger btn-sm">ลบข่าว</button>
      </form>
    </>
  );
}
