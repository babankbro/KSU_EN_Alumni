import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import PostCard from "@/components/PostCard";
import { query } from "@/lib/server/db";
import { getViewer, isMember, viewerAccount } from "@/lib/server/member-auth";
import {
  FEED_PAGE_SIZE,
  POST_TYPES,
  PUBLISHED_SQL,
  canInteract,
  listFeed,
  parseFeedFilter,
  postVisibleSql,
  type FeedFilter,
} from "@/lib/server/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ข่าวของศิษย์เก่า",
  description:
    "ฟีดข่าวที่ศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์ ส่งเข้ามาเอง ผ่านการตรวจสอบก่อนเผยแพร่",
};

type SP = Record<string, string | string[] | undefined>;

function qs(f: FeedFilter, patch: Partial<Record<keyof FeedFilter, string>>): string {
  const merged: Record<string, string> = { type: f.type, cohort: f.cohort, program: f.program, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/alumni-news?${s}` : "/alumni-news";
}

export default async function AlumniNewsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const f = parseFeedFilter(await searchParams);
  const viewer = await getViewer();
  const account = viewerAccount(viewer);

  // Filter options come from posts this viewer can actually read.
  const optParams: unknown[] = [];
  const visible = postVisibleSql(viewer, optParams);
  const [{ posts, total }, options] = await Promise.all([
    listFeed(f, viewer),
    query<{ cohort: number; program_id: number; program: string; level: string }>(
      `SELECT DISTINCT au.admission_year AS cohort, pr.current_id AS program_id,
              pr.current_name_th AS program, pr.degree_level::text AS level
       FROM alumni_post p JOIN alumni au ON au.id = p.author_id JOIN program_resolved pr ON pr.id = au.program_id
       WHERE ${PUBLISHED_SQL} AND au.anonymized_at IS NULL AND ${visible}`,
      optParams,
    ),
  ]);
  const cohorts = [...new Set(options.map((o) => o.cohort))].sort((a, b) => b - a);
  const programs = [...new Map(options.map((o) => [o.program_id, `${o.level} ${o.program}`])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "th"),
  );
  const pages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));
  const back = qs(f, { page: f.page > 1 ? String(f.page) : "" });
  const interact = canInteract(viewer);

  return (
    <>
      <PageHead
        crumb="ข่าวศิษย์เก่า"
        title="ข่าวของศิษย์เก่า"
        lead="ข่าวที่ศิษย์เก่าเป็นผู้ส่งเข้ามาเอง — ความก้าวหน้าในอาชีพ รางวัล ธุรกิจใหม่ และกิจกรรมของรุ่น"
      />

      <section className="section">
        <div className="wrap">
          <div className="grid feed-layout">
            <div>
              <nav className="feed-filters" aria-label="กรองประเภทข่าว">
                <Link className={`chip${!f.type ? " is-active" : ""}`} aria-current={!f.type ? "true" : undefined} href={qs(f, { type: "", page: "" })}>
                  ทั้งหมด
                </Link>
                {POST_TYPES.map((t) => (
                  <Link
                    key={t}
                    className={`chip${f.type === t ? " is-active" : ""}`}
                    aria-current={f.type === t ? "true" : undefined}
                    href={qs(f, { type: t, page: "" })}
                  >
                    {t}
                  </Link>
                ))}
              </nav>

              <form className="feed-subfilters" method="get" action="/alumni-news">
                {f.type ? <input type="hidden" name="type" value={f.type} /> : null}
                <div className="field narrow">
                  <label htmlFor="cohort">รุ่น</label>
                  <select id="cohort" name="cohort" defaultValue={f.cohort}>
                    <option value="">ทุกรุ่น</option>
                    {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="program">สาขา</label>
                  <select id="program" name="program" defaultValue={f.program}>
                    <option value="">ทุกสาขา</option>
                    {programs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn btn-outline btn-sm">กรอง</button>
              </form>

              <p className="small muted" aria-live="polite">
                พบ {total} ข่าว
                {!isMember(viewer) ? " · ข่าวบางส่วนแสดงเฉพาะสมาชิกที่ยืนยันตัวตนแล้ว" : ""}
              </p>

              {posts.length === 0 ? (
                <div className="empty-state">
                  <p style={{ marginBottom: 0 }}>ยังไม่มีข่าวที่ตรงกับตัวกรองนี้</p>
                </div>
              ) : (
                posts.map((p) => <PostCard key={p.id} post={p} canReact={interact} back={back} />)
              )}

              {pages > 1 ? (
                <nav className="pager" aria-label="เลือกหน้า">
                  {f.page > 1 ? <Link className="btn btn-outline btn-sm" href={qs(f, { page: String(f.page - 1) })}>← ใหม่กว่า</Link> : null}
                  <span>หน้า {f.page} / {pages}</span>
                  {f.page < pages ? <Link className="btn btn-outline btn-sm" href={qs(f, { page: String(f.page + 1) })}>เก่ากว่า →</Link> : null}
                </nav>
              ) : null}
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
                {account?.role === "alumni" ? (
                  <Link href="/me/posts/new" className="btn btn-gold btn-sm">+ ส่งข่าว</Link>
                ) : account ? null : (
                  <Link href="/login?next=/me/posts/new" className="btn btn-gold btn-sm">เข้าสู่ระบบเพื่อส่งข่าว</Link>
                )}
              </div>

              <div className="pdpa-note">
                <strong>การตรวจสอบเนื้อหา:</strong> ข่าวทุกชิ้นผ่านการตรวจสอบก่อนเผยแพร่
                โดยทั่วไปใช้เวลาไม่เกิน 1 วันทำการ ผู้ที่ถูกแท็กในข่าวสามารถปฏิเสธการแท็กได้
                และ<strong>ข่าวไว้อาลัยต้องผ่านการตรวจสอบเสมอ</strong>โดยไม่มีข้อยกเว้น
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
