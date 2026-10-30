import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import { listAwardees, openRound } from "@/lib/server/awards";
import { formatThaiDateOnly } from "@/lib/server/format-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ศิษย์เก่าดีเด่น",
  description: "ทำเนียบศิษย์เก่าดีเด่นคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยกาฬสินธุ์",
};

export default async function AwardsPage() {
  const [round, awardees] = await Promise.all([openRound(), listAwardees()]);
  return (
    <>
      <PageHead crumb="ศิษย์เก่าดีเด่น" title="ทำเนียบศิษย์เก่าดีเด่น" lead="ศิษย์เก่าที่สร้างคุณประโยชน์ต่อวิชาชีพ สังคม และคณะ" />
      <section className="section">
        <div className="wrap">
          {round ? (
            <div className="post-cta" style={{ marginBottom: 24 }}>
              <h3>{round.title}</h3>
              {round.description ? <p>{round.description}</p> : null}
              <p className="small">เปิดรับการเสนอชื่อถึง {formatThaiDateOnly(round.closesAt)}</p>
              <Link href="/awards/nominate" className="btn btn-gold btn-sm">เสนอชื่อศิษย์เก่า</Link>
            </div>
          ) : null}

          {awardees.length ? (
            <div className="grid grid-3">
              {awardees.map((a, i) => (
                <article key={i} className="card notable-card">
                  <div className="card-body">
                    {a.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.photoUrl} alt={`รูปของ ${a.name}`} className="notable-photo" loading="lazy" />
                    ) : (
                      <div className="portrait" aria-hidden="true">{a.name.replace(/^(นาย|นางสาว|นาง|ดร\.)/, "").slice(0, 2)}</div>
                    )}
                    {a.round ? <span className="tag tag-gold">{a.round}</span> : <span className="tag tag-gold">ศิษย์เก่าดีเด่น</span>}
                    <h3 style={{ marginTop: 8 }}>{a.listed && a.alumniId ? <Link href={`/directory/${a.alumniId}`}>{a.name}</Link> : a.name}</h3>
                    {a.cohort ? <p className="small muted">รุ่น {a.cohort}{a.program ? ` · ${a.program}` : ""}</p> : null}
                    {a.citation ? <p>{a.citation}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p style={{ marginBottom: 0 }}>ยังไม่มีรายชื่อศิษย์เก่าดีเด่น</p></div>
          )}
        </div>
      </section>
    </>
  );
}
