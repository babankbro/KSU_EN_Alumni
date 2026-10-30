import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/PageHead";
import PostCard from "@/components/PostCard";
import ReportForm from "@/components/ReportForm";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { getViewer, viewerAccount } from "@/lib/server/member-auth";
import { canInteract, getVisiblePost, listComments } from "@/lib/server/posts";
import { formatThaiDateTime } from "@/lib/server/format-server";
import { addCommentAction, deleteCommentAction, reportAction } from "../actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const post = Number.isInteger(id) ? await getVisiblePost(id, await getViewer()) : null;
  // Members-only posts must not leak their title through <title> to crawlers.
  return {
    title: post ? post.title : "ข่าวของศิษย์เก่า",
    robots: post?.visibility === "public" ? undefined : { index: false },
  };
}

export default async function AlumniPostPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const viewer = await getViewer();
  const post = await getVisiblePost(id, viewer);
  // Unpublished, hidden, or not visible to this viewer all look the same.
  if (!post) notFound();

  const comments = await listComments(id, viewer);
  const interact = canInteract(viewer);
  const account = viewerAccount(viewer);
  const back = `/alumni-news/${id}`;

  return (
    <>
      <PageHead crumb="ข่าวศิษย์เก่า" title={post.title} lead={post.type} />
      <section className="section">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <p className="small"><Link href="/alumni-news">← ข่าวของศิษย์เก่าทั้งหมด</Link></p>
          <PostCard post={post} canReact={interact} full back={back} />
          {interact ? <ReportForm action={reportAction} targetType="post" targetId={post.id} /> : null}

          <section id="comments" aria-labelledby="comments-h" className="comments">
            <h2 id="comments-h">ความคิดเห็น ({comments.length})</h2>
            {comments.length === 0 ? <p className="muted">ยังไม่มีความคิดเห็น</p> : null}
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id} className="comment">
                  <p className="comment-meta">
                    <strong>{c.authorName}</strong> · <span className="muted">{formatThaiDateTime(c.createdAt)}</span>
                  </p>
                  <p className="comment-body">{c.body}</p>
                  <div className="inline-actions">
                    {c.mine ? (
                      <form action={deleteCommentAction}>
                        <input type="hidden" name="commentId" value={c.id} />
                        <input type="hidden" name="back" value={`${back}#comments`} />
                        <button type="submit" className="link-danger">ลบความคิดเห็นของฉัน</button>
                      </form>
                    ) : interact ? (
                      <ReportForm action={reportAction} targetType="comment" targetId={c.id} label="รายงาน" />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            {interact ? (
              <ActionForm action={addCommentAction} submitLabel="ส่งความคิดเห็น" pendingLabel="กำลังส่ง…" className="comment-form" resetOnSuccess>
                <input type="hidden" name="postId" value={post.id} />
                <Field as="textarea" name="body" label="แสดงความคิดเห็น" rows={3} maxLength={1000} />
              </ActionForm>
            ) : account ? (
              <p className="small muted">บัญชีของคุณต้องได้รับการยืนยันตัวตนก่อนจึงจะแสดงความคิดเห็นได้</p>
            ) : (
              <p className="small">
                <Link href={`/login?next=${encodeURIComponent(back)}`}>เข้าสู่ระบบ</Link> เพื่อแสดงความยินดีหรือแสดงความคิดเห็น
              </p>
            )}
          </section>
        </div>
      </section>
    </>
  );
}
