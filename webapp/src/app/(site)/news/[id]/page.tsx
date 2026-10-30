import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/PageHead";
import { formatThaiDate } from "@/lib/format";
import { getPublishedNews } from "@/lib/server/content";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getPublishedNews(Number((await params).id));
  return item ? { title: item.title, description: item.summary } : { title: "ไม่พบข่าว" };
}

export default async function NewsDetailPage({ params }: Props) {
  const item = await getPublishedNews(Number((await params).id));
  if (!item) notFound();

  // Body is stored as plain text; blank lines separate paragraphs. Rendering
  // text (not HTML) means staff input can never inject markup into the page.
  const paragraphs = item.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <PageHead crumb="ข่าวประชาสัมพันธ์" title={item.title} lead={item.summary} />
      <section className="section">
        <div className="wrap">
          <article className="news-article">
            <p className="news-meta">
              <span className="tag tag-outline">{item.category}</span>{" "}
              เผยแพร่ {formatThaiDate(item.publishedAt)}
            </p>
            {item.coverSrc ? (
              <div className="news-article-cover">
                <Image src={item.coverSrc} alt="" fill sizes="(max-width: 860px) 100vw, 860px" priority />
              </div>
            ) : null}
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-line" }}>
                  {p}
                </p>
              ))
            ) : (
              <p>{item.summary}</p>
            )}
            {item.attachments.length ? (
              <section className="news-attachments" aria-labelledby="att-h">
                <h2 id="att-h">เอกสารแนบ</h2>
                <ul className="list-plain">
                  {item.attachments.map((a) => (
                    <li key={a.url}><a href={a.url} target="_blank" rel="noopener">📄 {a.label} (PDF)</a></li>
                  ))}
                </ul>
              </section>
            ) : null}
            {item.tags.length ? (
              <p className="news-tags">
                {item.tags.map((t) => (
                  <Link key={t} href={`/news?tag=${encodeURIComponent(t)}`} className="chip">#{t}</Link>
                ))}
              </p>
            ) : null}
            <p style={{ marginTop: 32 }}>
              <Link href="/news" className="btn btn-outline">
                ← ข่าวทั้งหมด
              </Link>
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
