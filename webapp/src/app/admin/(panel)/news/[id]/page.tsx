import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import NewsForm from "@/components/admin/NewsForm";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { addNewsAttachmentAction, removeNewsAttachmentAction } from "../../../actions";

export const metadata = { title: "แก้ไขข่าว" };

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(["admin", "editor"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [n] = await query<{
    id: number; title: string; summary: string | null; body: string | null; category: string | null;
    is_pinned: boolean; cover_file_id: string | null; is_future: boolean | null; local_at: string | null;
  }>(
    `SELECT id, title, summary, body, category, is_pinned, cover_file_id,
            published_at > now() AS is_future,
            to_char(published_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI') AS local_at
     FROM news WHERE id = $1`,
    [id],
  );
  if (!n) notFound();
  const [tags, attachments] = await Promise.all([
    query<{ tag: string }>(`SELECT tag FROM news_tag WHERE news_id = $1 ORDER BY tag`, [id]),
    query<{ file_id: string; label: string; size_bytes: string }>(
      `SELECT a.file_id, a.label, f.size_bytes FROM news_attachment a JOIN file_object f ON f.id = a.file_id WHERE a.news_id = $1 ORDER BY a.label`,
      [id],
    ),
  ]);

  return (
    <>
      <p className="small"><Link href="/admin/news">← ข่าวทั้งหมด</Link></p>
      <div className="admin-head"><h1>แก้ไขข่าว</h1></div>
      <NewsForm
        initial={{
          id: n.id,
          title: n.title,
          summary: n.summary ?? "",
          body: n.body ?? "",
          category: n.category ?? "ข่าวคณะ",
          isPinned: n.is_pinned,
          publishMode: n.local_at === null ? "draft" : n.is_future ? "schedule" : "now",
          publishAt: n.local_at ?? "",
          coverUrl: n.cover_file_id ? fileUrl(n.cover_file_id) : null,
          tags: tags.map((t) => t.tag).join(", "),
        }}
      />

      <section className="admin-card" id="attachments" aria-labelledby="att-h">
        <h2 id="att-h">เอกสารแนบ (PDF)</h2>
        {attachments.length ? (
          <ul className="list-plain">
            {attachments.map((a) => (
              <li key={a.file_id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                <a href={fileUrl(a.file_id)} target="_blank" rel="noopener">📄 {a.label}</a>
                <span className="inline-actions">
                  <span className="small muted">{Math.ceil(Number(a.size_bytes) / 1024)} KB</span>
                  <form action={removeNewsAttachmentAction}>
                    <input type="hidden" name="newsId" value={n.id} />
                    <input type="hidden" name="fileId" value={a.file_id} />
                    <button type="submit" className="link-danger">นำออก</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">ยังไม่มีเอกสารแนบ</p>}
        <ActionForm action={addNewsAttachmentAction} submitLabel="+ แนบเอกสาร" className="" submitClassName="btn btn-outline btn-sm" encType="multipart/form-data" resetOnSuccess>
          <input type="hidden" name="newsId" value={n.id} />
          <div className="field-grid">
            <Field name="label" label="ชื่อเอกสาร" maxLength={120} />
            <div className="field">
              <label htmlFor="att-file">ไฟล์ PDF ไม่เกิน 10 MB</label>
              <input id="att-file" name="file" type="file" accept="application/pdf" />
            </div>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
