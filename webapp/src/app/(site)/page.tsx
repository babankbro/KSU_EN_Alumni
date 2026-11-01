import Link from "next/link";
import Image from "next/image";
import { NEWS } from "@/lib/data";
import SectionHead from "@/components/SectionHead";
import StatsStrip from "@/components/StatsStrip";
import DirectoryCard from "@/components/DirectoryCard";
import EventRow from "@/components/EventRow";
import NewsGrid from "@/components/NewsGrid";
import JobItem from "@/components/JobItem";
import PostCard from "@/components/PostCard";
import { getSettings, getSiteImages, listPublishedNews } from "@/lib/server/content";
import { getViewer, viewerAccount } from "@/lib/server/member-auth";
import { listAwardees } from "@/lib/server/awards";
import { getDirectoryOptions, parseDirFilter, searchDirectory } from "@/lib/server/directory";
import { canInteract, listFeed } from "@/lib/server/posts";
import { listUpcomingEvents } from "@/lib/server/events";
import { listJobs, parseJobFilter } from "@/lib/server/jobs";

/** Each home section degrades to empty instead of failing the whole page. */
async function safe<T>(p: Promise<T>, fallback: T, what: string): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.error(`[home] ${what} unavailable`, err);
    return fallback;
  }
}

export default async function HomePage() {
  const viewer = await getViewer();
  const account = viewerAccount(viewer);
  const [settings, images, dbNews, awardees, people, feed, upcoming, jobs, heroOptions] = await Promise.all([
    getSettings(),
    getSiteImages(),
    listPublishedNews(3),
    safe(listAwardees(), [], "awardees"),
    safe(searchDirectory(parseDirFilter({}), viewer).then((r) => r.people), [], "directory"),
    safe(listFeed({ type: "", cohort: "", program: "", page: 1 }, viewer, 3).then((r) => r.posts), [], "alumni news"),
    safe(listUpcomingEvents(4), [], "events"),
    safe(listJobs(parseJobFilter({})).then((r) => r.jobs.slice(0, 3)), [], "jobs"),
    safe(
      getDirectoryOptions(),
      [],
      "hero options",
    ),
  ]);

  const notable = awardees.slice(0, 4);
  // Prefer people with a photo the viewer may see, as in the design.
  const directoryPreview = [...people].sort((a, b) => Number(Boolean(b.photoUrl)) - Number(Boolean(a.photoUrl))).slice(0, 4);
  const cohorts = heroOptions.filter((o) => o.kind === "cohort").sort((a, b) => Number(b.value) - Number(a.value));
  const programs = heroOptions.filter((o) => o.kind === "program").sort((a, b) => a.label.localeCompare(b.label, "th"));
  const interact = canInteract(viewer);
  // News is edited from /admin/news; the bundled samples are only a fallback
  // for when the database is unreachable.
  const latestNews = dbNews ?? NEWS.slice(0, 3);
  const hero = images.hero;
  const dean = images.dean;

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        {hero?.src ? (
          <Image className="hero-image" src={hero.src} alt={hero.alt} fill priority sizes="100vw" />
        ) : null}
        <div className="wrap">
          <span className="hero-eyebrow">{settings["hero.eyebrow"]}</span>
          <h1>
            {settings["hero.title"]}
            <em>{settings["hero.titleEm"]}</em>
          </h1>
          <p className="hero-lead">{settings["hero.lead"]}</p>

          <div className="hero-actions">
            <Link href="/register" className="btn btn-gold">
              ยืนยันตัวตนศิษย์เก่า
            </Link>
            <Link href="/directory" className="btn btn-ghost-light">
              ค้นหาเพื่อนร่วมรุ่น
            </Link>
            <Link href="/alumni-news" className="btn btn-ghost-light">
              ส่งข่าวของคุณ
            </Link>
          </div>

          <div className="hero-search">
            <form action="/directory">
              <label className="sr-only" htmlFor="q">
                ค้นหาชื่อศิษย์เก่า
              </label>
              <input
                id="q"
                name="q"
                type="search"
                placeholder="ค้นหาชื่อ นามสกุล หรือรหัสนักศึกษา"
              />
              <label className="sr-only" htmlFor="cohort">
                รุ่น
              </label>
              <select id="cohort" name="cohort" defaultValue="">
                <option value="">ทุกรุ่น</option>
                {cohorts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <label className="sr-only" htmlFor="program">
                สาขาวิชา
              </label>
              <select id="program" name="program" defaultValue="">
                <option value="">ทุกสาขา</option>
                {programs.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button className="btn btn-primary" type="submit">
                ค้นหา
              </button>
            </form>
            <p className="hero-note">
              🔒 ข้อมูลติดต่อของศิษย์เก่าจะแสดงเฉพาะผู้ที่เข้าสู่ระบบแล้วเท่านั้น (ตาม PDPA)
            </p>
          </div>
        </div>
      </section>

      <StatsStrip />

      {/* ---------- Notable alumni (FR-AWD-04) ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            title="ศิษย์เก่าดีเด่น"
            sub="ศิษย์เก่าที่สร้างคุณประโยชน์ต่อวิชาชีพ สังคม และคณะ"
            actionLabel="ดูทั้งหมด"
            actionHref="/awards"
          />
          <div className="grid grid-4">
            {notable.map((a, i) => (
              <article className="card" key={`${a.alumniId ?? a.name}-${i}`}>
                {a.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="portrait portrait-photo" src={a.photoUrl} alt={`รูปของ ${a.name}`} loading="lazy" />
                ) : (
                  <div className="portrait" aria-hidden="true">{a.name.replace(/^(นาย|นางสาว|นาง|ดร\.)/, "").slice(0, 2)}</div>
                )}
                <div className="card-body">
                  {a.cohort ? <span className="tag">รุ่น {a.cohort}{a.program ? ` · ${a.program}` : ""}</span> : null}
                  <h3>{a.name}</h3>
                  <p>{a.citation}</p>
                  <div className="card-foot">
                    {a.listed && a.alumniId ? <Link href={`/directory/${a.alumniId}`}>ดูโปรไฟล์ →</Link> : <Link href="/awards">ทำเนียบศิษย์เก่าดีเด่น →</Link>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Directory preview (FR-DIR-04) ---------- */}
      <section className="section section-alt">
        <div className="wrap">
          <SectionHead
            title="ทำเนียบศิษย์เก่า"
            sub="ค้นหาได้หลายมิติพร้อมกัน — รุ่น สาขา จังหวัด องค์กร ตำแหน่ง และทักษะ"
            actionLabel="เปิดทำเนียบทั้งหมด"
            actionHref="/directory"
          />
          <div className="person-list">
            {directoryPreview.map((p) => (
              <DirectoryCard key={p.id} p={p} signedIn={viewer.kind !== "anonymous"} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Alumni news (FR-ANEWS) ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            title="ข่าวของศิษย์เก่า"
            sub="ข่าวที่ศิษย์เก่าเป็นผู้ส่งเข้ามาเอง ทุกชิ้นผ่านการตรวจสอบก่อนเผยแพร่"
            actionLabel="ดูฟีดทั้งหมด"
            actionHref="/alumni-news"
          />
          <div className="grid feed-layout">
            <div>
              {feed.length ? feed.map((post) => <PostCard key={post.id} post={post} canReact={interact} back="/" />) : (
                <div className="empty-state"><p style={{ marginBottom: 0 }}>ยังไม่มีข่าวของศิษย์เก่า</p></div>
              )}
            </div>

            <aside>
              <div className="post-cta">
                <h3>มีข่าวดีอยากเล่า?</h3>
                <p>ศิษย์เก่าที่ยืนยันตัวตนแล้วส่งข่าวของตัวเองขึ้นเว็บได้</p>
                <ul>
                  <li>เลื่อนตำแหน่ง เปลี่ยนงาน เรียนต่อ</li>
                  <li>รางวัลและความสำเร็จ</li>
                  <li>เปิดธุรกิจหรือผลงานใหม่</li>
                  <li>นัดรวมรุ่นและกิจกรรมของรุ่น</li>
                </ul>
                <Link href={account ? "/me/posts/new" : "/login?next=/me/posts/new"} className="btn btn-gold btn-sm">
                  {account ? "+ ส่งข่าว" : "เข้าสู่ระบบเพื่อส่งข่าว"}
                </Link>
                <p
                  style={{
                    margin: "14px 0 0",
                    fontSize: ".78rem",
                    color: "rgba(255,255,255,.65)",
                  }}
                >
                  ทุกข่าวผ่านการตรวจสอบก่อนเผยแพร่ โดยทั่วไปใช้เวลาไม่เกิน 1 วันทำการ
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ---------- Events ---------- */}
      <section className="section section-alt">
        <div className="wrap">
          <SectionHead
            title="กิจกรรมที่กำลังจะมาถึง"
            sub="งานคืนสู่เหย้า กิจกรรมแนะแนวอาชีพ และงานของแต่ละรุ่น"
            actionLabel="ดูปฏิทินทั้งหมด"
            actionHref="/events"
          />
          <div className="card">
            {upcoming.length ? upcoming.map((e) => <EventRow key={e.id} e={e} />) : <p className="muted" style={{ padding: 20 }}>ยังไม่มีกิจกรรมที่กำหนดไว้</p>}
          </div>
        </div>
      </section>

      {/* ---------- Official news ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            title="ข่าวประชาสัมพันธ์"
            sub="ข่าวสารจากคณะและสมาคมศิษย์เก่า"
            actionLabel="ดูทั้งหมด"
            actionHref="/news"
          />
          <NewsGrid items={latestNews} />
        </div>
      </section>

      {/* ---------- §5.9 Jobs and internships ---------- */}
      <section className="section section-tint">
        <div className="wrap">
          <SectionHead
            title="งานและฝึกงานจากรุ่นพี่"
            sub="ตำแหน่งที่ศิษย์เก่าแบ่งปันมาถึงรุ่นน้องโดยตรง"
            actionLabel="ดูตำแหน่งทั้งหมด"
            actionHref="/jobs"
          />
          <div className="grid grid-3">
            {jobs.map((j) => <JobItem key={j.id} job={j} />)}
          </div>
        </div>
      </section>

      {/* ---------- Dean message ---------- */}
      <section className="section section-dark">
        <div className="wrap">
          <SectionHead title="สารจากคณบดี" />
          <div className="dean">
            {dean?.src ? (
              <div className="dean-portrait dean-portrait-photo">
                <Image src={dean.src} alt={dean.alt} fill sizes="240px" style={{ objectFit: "cover" }} />
              </div>
            ) : (
              <div className="dean-portrait" aria-hidden="true">
                คณบดี
              </div>
            )}
            <div>
              <blockquote>{settings["dean.quote"]}</blockquote>
              <cite>
                <strong>{settings["dean.name"]}</strong>
                <span>{settings["dean.org"]}</span>
              </cite>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- §5.11 Engagement CTA ---------- */}
      <section className="engagement">
        <div className="wrap">
          <h2>กลับมาอัปเดตเรื่องราวของคุณ</h2>
          <p>
            ข้อมูลที่เป็นปัจจุบันช่วยให้เพื่อนร่วมรุ่นติดต่อคุณได้
            ช่วยให้คณะส่งข่าวและสิทธิประโยชน์ถึงคุณได้ตรง
            และช่วยให้หลักสูตรปรับตามเส้นทางอาชีพจริงของศิษย์เก่า
          </p>
          <div className="engagement-actions">
            <Link href={account ? "/me" : "/register"} className="btn btn-on-dark">
              อัปเดตโปรไฟล์
            </Link>
            <Link href="/about" className="link-light">
              ข้อมูลของฉันถูกใช้เพื่ออะไร?
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
