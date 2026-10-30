import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import JobItem from "@/components/JobItem";
import { JOB_PAGE_SIZE, JOB_TYPES, jobFilterOptions, listJobs, parseJobFilter, type JobFilter } from "@/lib/server/jobs";
import { getMemberAccount } from "@/lib/server/member-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "งานและฝึกงาน",
  description: "ตำแหน่งงานและที่ฝึกงานที่ศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์ แบ่งปันให้รุ่นน้อง",
};

function qs(f: JobFilter, page: number): string {
  const p = new URLSearchParams();
  for (const k of ["q", "type", "program", "province", "skill"] as const) if (f[k]) p.set(k, f[k]);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `/jobs?${s}` : "/jobs";
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = parseJobFilter(await searchParams);
  const [{ jobs, total }, opts, account] = await Promise.all([listJobs(f), jobFilterOptions(), getMemberAccount()]);
  const pages = Math.max(1, Math.ceil(total / JOB_PAGE_SIZE));
  const filtered = f.q || f.type || f.program || f.province || f.skill;

  return (
    <>
      <PageHead crumb="งานและฝึกงาน" title="งานและฝึกงาน" lead="ตำแหน่งงาน ที่ฝึกงาน และสหกิจศึกษาที่ศิษย์เก่าแบ่งปันมาถึงรุ่นน้องโดยตรง" />
      <section className="section">
        <div className="wrap">
          <form className="filter-bar job-filters" method="get" action="/jobs" role="search">
            <div className="field">
              <label htmlFor="jq">ค้นหา</label>
              <input id="jq" name="q" type="search" defaultValue={f.q} placeholder="ตำแหน่ง บริษัท หรือคำในรายละเอียด" />
            </div>
            <div className="field narrow">
              <label htmlFor="jt">ประเภท</label>
              <select id="jt" name="type" defaultValue={f.type}>
                <option value="">ทุกประเภท</option>
                {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="jp">สาขาที่รับ</label>
              <select id="jp" name="program" defaultValue={f.program}>
                <option value="">ทุกสาขา</option>
                {opts.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field narrow">
              <label htmlFor="jv">จังหวัด</label>
              <select id="jv" name="province" defaultValue={f.province}>
                <option value="">ทุกจังหวัด</option>
                {opts.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {opts.skills.length ? (
              <div className="field narrow">
                <label htmlFor="js">ทักษะ</label>
                <select id="js" name="skill" defaultValue={f.skill}>
                  <option value="">ทุกทักษะ</option>
                  {opts.skills.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : null}
            <button type="submit" className="btn btn-primary">ค้นหา</button>
            {filtered ? <Link href="/jobs" className="btn btn-outline">ล้างตัวกรอง</Link> : null}
          </form>

          <div className="inline-actions" style={{ justifyContent: "space-between", margin: "8px 0 16px" }}>
            <p className="small muted" style={{ margin: 0 }} aria-live="polite">พบ {total} ประกาศที่ยังเปิดรับ</p>
            {account?.role === "alumni" ? <Link href="/me/jobs/new" className="btn btn-gold btn-sm">+ ประกาศงาน</Link> : null}
          </div>

          {jobs.length ? (
            <div className="grid grid-3">{jobs.map((j) => <JobItem key={j.id} job={j} />)}</div>
          ) : (
            <div className="empty-state"><p style={{ marginBottom: 0 }}>ยังไม่มีประกาศที่ตรงกับเงื่อนไข</p></div>
          )}

          {pages > 1 ? (
            <nav className="pager" aria-label="เลือกหน้า">
              {f.page > 1 ? <Link className="btn btn-outline btn-sm" href={qs(f, f.page - 1)}>← ก่อนหน้า</Link> : null}
              <span>หน้า {f.page} / {pages}</span>
              {f.page < pages ? <Link className="btn btn-outline btn-sm" href={qs(f, f.page + 1)}>ถัดไป →</Link> : null}
            </nav>
          ) : null}

          <div className="privacy-note">
            <p>
              <strong>สำหรับศิษย์เก่า:</strong> ประกาศงานทุกชิ้นผ่านการตรวจสอบก่อนเผยแพร่ และหมดอายุอัตโนมัติเมื่อเลยวันปิดรับ ·{" "}
              <strong>สำหรับนักศึกษา:</strong> เข้าสู่ระบบเพื่อดูช่องทางสมัครและรับแจ้งเตือนประกาศใหม่
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
