import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import NewsGrid from "@/components/NewsGrid";
import { NEWS } from "@/lib/data";
import { newsFacets, searchPublishedNews } from "@/lib/server/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ข่าวประชาสัมพันธ์",
  description: "ข่าวสารจากคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม ม.กาฬสินธุ์ และสมาคมศิษย์เก่า",
};

type SP = { q?: string; category?: string; tag?: string };

/** FR-NEWS-02/03 — official news with search, categories and tags. */
export default async function NewsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = { q: (sp.q ?? "").trim().slice(0, 100), category: (sp.category ?? "").slice(0, 60), tag: (sp.tag ?? "").slice(0, 30) };
  let news: Awaited<ReturnType<typeof searchPublishedNews>> | typeof NEWS;
  let facets = { categories: [] as string[], tags: [] as { tag: string; n: number }[] };
  try {
    [news, facets] = await Promise.all([searchPublishedNews(f), newsFacets()]);
  } catch (err) {
    console.error("[news] unavailable", err);
    news = NEWS; // database down: show the bundled sample rather than an error
  }
  const link = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/news?${s}` : "/news";
  };
  const filtered = f.q || f.category || f.tag;

  return (
    <>
      <PageHead crumb="ข่าวประชาสัมพันธ์" title="ข่าวประชาสัมพันธ์" lead="ข่าวสารทางการจากคณะและสมาคมศิษย์เก่า" />
      <section className="section">
        <div className="wrap">
          <form className="filter-bar" method="get" action="/news" role="search">
            <div className="field">
              <label htmlFor="nq">ค้นหาข่าว</label>
              <input id="nq" name="q" type="search" defaultValue={f.q} placeholder="เช่น ทุนการศึกษา, คืนสู่เหย้า" />
            </div>
            {facets.categories.length ? (
              <div className="field narrow">
                <label htmlFor="nc">หมวด</label>
                <select id="nc" name="category" defaultValue={f.category}>
                  <option value="">ทุกหมวด</option>
                  {facets.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ) : null}
            {f.tag ? <input type="hidden" name="tag" value={f.tag} /> : null}
            <button type="submit" className="btn btn-primary">ค้นหา</button>
            {filtered ? <Link href="/news" className="btn btn-outline">ล้างตัวกรอง</Link> : null}
            <Link href="/gallery" className="btn btn-outline">แกลเลอรีภาพกิจกรรม</Link>
          </form>
          {facets.tags.length ? (
            <nav className="feed-filters" aria-label="แท็กข่าว">
              {facets.tags.map((t) => (
                <Link key={t.tag} href={link({ tag: f.tag === t.tag ? "" : t.tag })} className={`chip${f.tag === t.tag ? " is-active" : ""}`} aria-current={f.tag === t.tag ? "true" : undefined}>
                  #{t.tag} <span className="muted">({t.n})</span>
                </Link>
              ))}
            </nav>
          ) : null}
          {filtered ? <p className="small muted" aria-live="polite">พบ {news.length} ข่าว</p> : null}
          <NewsGrid items={news} />
        </div>
      </section>
    </>
  );
}
