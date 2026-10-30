import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import NewsForm from "@/components/admin/NewsForm";

export const metadata = { title: "แก้ไขข่าว" };

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
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
        }}
      />
    </>
  );
}
