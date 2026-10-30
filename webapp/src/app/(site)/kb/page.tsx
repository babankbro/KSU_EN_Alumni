import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import { KB_CATEGORIES, categoryCounts, searchArticles } from "@/lib/server/kb";
import { formatThaiDateOnly } from "@/lib/server/format-server";
import { getMemberAccount } from "@/lib/server/member-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "คลังความรู้จากรุ่นพี่",
  description: "บทความแบ่งปันประสบการณ์การทำงาน การเรียนต่อ และการสอบใบประกอบวิชาชีพ จากศิษย์เก่า",
};

export default async function KbPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const c = (KB_CATEGORIES as readonly string[]).includes(sp.c ?? "") ? sp.c! : "";
  const [articles, counts, account] = await Promise.all([searchArticles(q, c), categoryCounts(), getMemberAccount()]);

  return (
    <>
      <PageHead crumb="คลังความรู้" title="คลังความรู้จากรุ่นพี่" lead="ประสบการณ์จริงจากศิษย์เก่า — งานแรก การเรียนต่อ ใบ กว. และการเริ่มธุรกิจ" />
      <section className="section">
        <div className="wrap">
          <form className="filter-bar" method="get" action="/kb" role="search">
            <div className="field">
              <label htmlFor="kq">ค้นหาบทความ</label>
              <input id="kq" name="q" type="search" defaultValue={q} placeholder="เช่น สัมภาษณ์งาน, ใบ กว., ป.โท" />
            </div>
            {c ? <input type="hidden" name="c" value={c} /> : null}
            <button type="submit" className="btn btn-primary">ค้นหา</button>
            {account?.role === "alumni" ? <Link href="/me/kb/new" className="btn btn-gold">+ เขียนบทความ</Link> : null}
          </form>

          <nav className="feed-filters" aria-label="หมวดบทความ">
            <Link className={`chip${!c ? " is-active" : ""}`} aria-current={!c ? "true" : undefined} href={q ? `/kb?q=${encodeURIComponent(q)}` : "/kb"}>ทั้งหมด</Link>
            {KB_CATEGORIES.map((k) => (
              <Link key={k} className={`chip${c === k ? " is-active" : ""}`} aria-current={c === k ? "true" : undefined}
                href={`/kb?c=${encodeURIComponent(k)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
                {k} <span className="muted">({counts.get(k) ?? 0})</span>
              </Link>
            ))}
          </nav>

          {articles.length ? (
            <div className="grid grid-3">
              {articles.map((a) => (
                <article key={a.id} className="card">
                  <div className="card-body">
                    <span className="tag">{a.category}</span>
                    <h3 style={{ marginTop: 8 }}><Link href={`/kb/${a.id}`}>{a.title}</Link></h3>
                    {a.summary ? <p>{a.summary}</p> : null}
                    <p className="small muted">{a.author.name} · รุ่น {a.author.admissionYear} · {formatThaiDateOnly(a.publishedAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p style={{ marginBottom: 0 }}>ยังไม่มีบทความที่ตรงกับการค้นหา</p></div>
          )}
        </div>
      </section>
    </>
  );
}
