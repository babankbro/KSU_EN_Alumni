import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { ArticleEditor } from "../../activity/editors";
import { deleteArticleAction } from "../../activity/actions";

export const metadata = { title: "แก้ไขบทความ" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const acc = await requireMember({ alumni: true, verified: true });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [k] = await query<{ id: number; title: string; summary: string | null; body: string; category: string; moderation_status: string; moderation_note: string | null }>(
    `SELECT id, title, summary, body, category, moderation_status::text AS moderation_status, moderation_note
     FROM kb_article WHERE id = $1 AND author_id = $2`,
    [id, acc.alumniId],
  );
  if (!k) notFound();
  return (
    <>
      <p className="small"><Link href="/me/activity">← กิจกรรม งาน บทความ</Link></p>
      <div className="admin-head"><h1>แก้ไขบทความ</h1></div>
      {k.moderation_note && k.moderation_status !== "approved" ? (
        <p className="flash flash-warn" role="status"><strong>ความเห็นจากผู้ตรวจสอบ:</strong> {k.moderation_note}</p>
      ) : null}
      {k.moderation_status === "hidden" ? <p className="muted">บทความนี้ถูกซ่อนโดยผู้ตรวจสอบ จึงแก้ไขไม่ได้</p> : <ArticleEditor article={k} />}
      <form action={deleteArticleAction} className="admin-card danger-zone">
        <input type="hidden" name="recordId" value={k.id} />
        <h2>ลบบทความ</h2>
        <ConfirmButton message="ลบบทความนี้?" className="btn btn-danger btn-sm">ลบบทความ</ConfirmButton>
      </form>
    </>
  );
}
