import Link from "next/link";
import Image from "next/image";
import { ALUMNI, ALUMNI_POSTS, EVENTS, JOB_POSTS, NEWS, programName } from "@/lib/data";
import SectionHead from "@/components/SectionHead";
import StatsStrip from "@/components/StatsStrip";
import PersonCard from "@/components/PersonCard";
import EventList from "@/components/EventList";
import NewsGrid from "@/components/NewsGrid";
import JobCard from "@/components/JobCard";
import { relativeThai } from "@/lib/format";

export default function HomePage() {
  const notable = ALUMNI.filter((a) => a.isNotable).slice(0, 4);
  const directoryPreview = ALUMNI.filter((a) => a.imageSrc).slice(0, 4);
  const feedPreview = ALUMNI_POSTS.slice(0, 3);
  const upcoming = EVENTS.slice(0, 4);
  const latestNews = NEWS.slice(0, 3);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <Image
          className="hero-image"
          src="/images/hero-alumni.png"
          alt="ศิษย์เก่าและนักศึกษาวิศวกรรมศาสตร์แลกเปลี่ยนประสบการณ์ในมหาวิทยาลัย"
          fill
          priority
          sizes="100vw"
        />
        <div className="wrap">
          <span className="hero-eyebrow">
            Faculty of Engineering · Kalasin University
          </span>
          <h1>
            เครือข่ายศิษย์เก่า
            <em>คณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์</em>
          </h1>
          <p className="hero-lead">
            รวมพลังศิษย์เก่าทุกรุ่นทุกสาขา เพื่อเชื่อมโยงรุ่นพี่รุ่นน้อง
            แบ่งปันโอกาสทางอาชีพ และร่วมพัฒนาหลักสูตรของคณะอย่างต่อเนื่อง
          </p>

          <div className="hero-actions">
            <a href="#" className="btn btn-gold">
              ยืนยันตัวตนศิษย์เก่า
            </a>
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
                <option>2566</option>
                <option>2564</option>
                <option>2562</option>
                <option>2560</option>
              </select>
              <label className="sr-only" htmlFor="program">
                สาขาวิชา
              </label>
              <select id="program" name="program" defaultValue="">
                <option value="">ทุกสาขา</option>
                <option>วิศวกรรมคอมพิวเตอร์</option>
                <option>วิศวกรรมเครื่องกล</option>
                <option>วิศวกรรมไฟฟ้า</option>
                <option>วิศวกรรมโลจิสติกส์</option>
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
            actionHref="/news"
          />
          <div className="grid grid-4">
            {notable.map((a) => (
              <article className="card" key={a.id}>
                {a.imageSrc ? (
                  <Image
                    className="portrait portrait-photo"
                    src={a.imageSrc}
                    alt={`ภาพตัวอย่าง ${a.titleTh}${a.firstNameTh} ${a.lastNameTh}`}
                    width={768}
                    height={1024}
                    sizes="(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="portrait" aria-hidden="true">
                    {a.firstNameTh.slice(0, 2)}
                  </div>
                )}
                <div className="card-body">
                  <span className="tag">
                    รุ่น {a.admissionYear} · {programName(a.programId)}
                  </span>
                  <h3>
                    {a.titleTh}
                    {a.firstNameTh} {a.lastNameTh}
                  </h3>
                  <p>{a.notableCitation}</p>
                  <div className="card-foot">
                    <a href="#">อ่านต่อ →</a>
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
              <PersonCard key={p.id} person={p} />
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
              {feedPreview.map((post) => {
                const author = ALUMNI.find((a) => a.id === post.authorId);
                return (
                  <article className="post" key={post.id}>
                    <div className="post-head">
                      <div className="portrait portrait-sm" aria-hidden="true">
                        {author?.firstNameTh.slice(0, 2) ?? "??"}
                      </div>
                      <div>
                        <h4>
                          {author
                            ? `${author.titleTh}${author.firstNameTh} ${author.lastNameTh}`
                            : "ศิษย์เก่า"}
                        </h4>
                        <p className="meta">
                          {author
                            ? `รุ่น ${author.admissionYear} · ${programName(author.programId)} · `
                            : ""}
                          {relativeThai(post.publishedAt)}
                        </p>
                      </div>
                      <span className="tag post-type">{post.type}</span>
                    </div>
                    <div className="post-body">
                      <h3>{post.title}</h3>
                      <p>{post.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside>
              <div className="post-cta">
                <h3>มีข่าวดีอยากเล่า?</h3>
                <p>ศิษย์เก่าทุกคนส่งข่าวของตัวเองขึ้นเว็บได้ ไม่ต้องผ่านเจ้าหน้าที่</p>
                <ul>
                  <li>เลื่อนตำแหน่ง เปลี่ยนงาน เรียนต่อ</li>
                  <li>รางวัลและความสำเร็จ</li>
                  <li>เปิดธุรกิจหรือผลงานใหม่</li>
                  <li>นัดรวมรุ่นและกิจกรรมของรุ่น</li>
                </ul>
                <a href="#" className="btn btn-gold btn-sm">
                  เข้าสู่ระบบเพื่อส่งข่าว
                </a>
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
            <EventList events={upcoming} />
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
            {JOB_POSTS.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Dean message ---------- */}
      <section className="section section-dark">
        <div className="wrap">
          <SectionHead title="สารจากคณบดี" />
          <div className="dean">
            <div className="dean-portrait" aria-hidden="true">
              คณบดี
            </div>
            <div>
              <blockquote>
                ศิษย์เก่าคือภาพสะท้อนที่ตรงที่สุดว่าคณะของเราผลิตบัณฑิตได้ตรงกับความต้องการของสังคมเพียงใด
                ระบบศิษย์เก่านี้จึงไม่ได้ทำขึ้นเพื่อเก็บรายชื่อ
                แต่ทำขึ้นเพื่อให้เสียงของศิษย์เก่ากลับมาถึงห้องเรียน
                และเพื่อให้รุ่นพี่ส่งต่อโอกาสให้รุ่นน้องได้จริง
              </blockquote>
              <cite>
                <strong>คณบดีคณะวิศวกรรมศาสตร์</strong>
                <span>มหาวิทยาลัยกาฬสินธุ์</span>
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
            <a href="#" className="btn btn-on-dark">
              อัปเดตโปรไฟล์
            </a>
            <Link href="/about" className="link-light">
              ข้อมูลของฉันถูกใช้เพื่ออะไร?
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
