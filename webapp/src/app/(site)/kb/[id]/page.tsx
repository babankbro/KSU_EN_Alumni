import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/PageHead";
import ReportForm from "@/components/ReportForm";
import { getPublishedArticle } from "@/lib/server/kb";
import { formatThaiDateOnly } from "@/lib/server/format-server";
import { getViewer } from "@/lib/server/member-auth";
import { canInteract } from "@/lib/server/posts";
import { reportAction } from "@/app/(site)/alumni-news/actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await getPublishedArticle(id) : null;
  return { title: a?.title ?? "บทความ", description: a?.summary ?? undefined };
}

export default async function ArticlePage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const a = await getPublishedArticle(id);
  if (!a) notFound();
  const viewer = await getViewer();

  return (
    <>
      <PageHead crumb="คลังความรู้" title={a.title} lead={a.summary ?? a.category} />
      <section className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="small"><Link href="/kb">← คลังความรู้</Link> · <Link href={`/kb?c=${encodeURIComponent(a.category)}`}>{a.category}</Link></p>
          <p className="small muted">
            โดย {a.author.listed ? <Link href={`/directory/${a.author.id}`}>{a.author.name}</Link> : a.author.name} · รุ่น {a.author.admissionYear} ·{" "}
            {a.author.program} · {formatThaiDateOnly(a.publishedAt)}
          </p>
          <article className="admin-card"><p className="post-text" style={{ margin: 0 }}>{a.body}</p></article>
          {canInteract(viewer) ? <ReportForm action={reportAction} targetType="kb" targetId={a.id} /> : null}
        </div>
      </section>
    </>
  );
}
