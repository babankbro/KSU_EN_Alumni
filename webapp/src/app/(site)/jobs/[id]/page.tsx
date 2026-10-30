import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/PageHead";
import ReportForm from "@/components/ReportForm";
import { getLiveJob } from "@/lib/server/jobs";
import { formatThaiDateOnly } from "@/lib/server/format-server";
import { getViewer } from "@/lib/server/member-auth";
import { canInteract } from "@/lib/server/posts";
import { reportAction } from "@/app/(site)/alumni-news/actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const job = Number.isInteger(id) ? await getLiveJob(id) : null;
  return { title: job ? `${job.title} — ${job.organization}` : "ประกาศงาน" };
}

/** FR-JOB-03/05 — job detail. How to apply is shown to signed-in students, alumni and staff. */
export default async function JobPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const job = await getLiveJob(id);
  if (!job) notFound();
  const viewer = await getViewer();
  const signedIn = viewer.kind !== "anonymous";

  return (
    <>
      <PageHead crumb="งานและฝึกงาน" title={job.title} lead={job.organization} />
      <section className="section">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <p className="small"><Link href="/jobs">← ประกาศงานทั้งหมด</Link></p>
          <div className="admin-grid-2">
            <section className="admin-card">
              <h2>ข้อมูลตำแหน่ง</h2>
              <dl className="kv">
                <dt>ประเภท</dt><dd>{job.type}</dd>
                <dt>สถานที่</dt><dd>{[job.location, job.province && job.province !== job.location ? job.province : null].filter(Boolean).join(", ") || "—"}</dd>
                <dt>ปิดรับ</dt><dd>{job.closesAt ? formatThaiDateOnly(job.closesAt) : "จนกว่าจะได้คน"}</dd>
                {job.programs.length ? (<><dt>สาขาที่รับ</dt><dd>{job.programs.join(", ")}</dd></>) : null}
                {job.skills.length ? (<><dt>ทักษะ</dt><dd>{job.skills.join(", ")}</dd></>) : null}
                {job.posterName ? (<><dt>แบ่งปันโดย</dt><dd>ศิษย์เก่า {job.posterName}</dd></>) : null}
              </dl>
            </section>
            <section className="admin-card">
              <h2>วิธีสมัคร</h2>
              {signedIn ? (
                <>
                  {job.applyUrl ? <p><a className="btn btn-primary" href={job.applyUrl} target="_blank" rel="noopener noreferrer nofollow">สมัครผ่านเว็บไซต์ ↗</a></p> : null}
                  {job.contactEmail ? <p>ส่งใบสมัครทางอีเมล <a href={`mailto:${job.contactEmail}`}>{job.contactEmail}</a></p> : null}
                  {!job.applyUrl && !job.contactEmail ? <p className="muted">ดูวิธีสมัครในรายละเอียด</p> : null}
                </>
              ) : (
                <p><Link href={`/login?next=/jobs/${job.id}`}>เข้าสู่ระบบ</Link> เพื่อดูช่องทางการสมัคร (นักศึกษาสมัครบัญชีได้ด้วยรหัสนักศึกษา)</p>
              )}
            </section>
          </div>
          {job.description ? (
            <section className="admin-card">
              <h2>รายละเอียด</h2>
              <p className="post-text">{job.description}</p>
            </section>
          ) : null}
          {canInteract(viewer) ? <ReportForm action={reportAction} targetType="job" targetId={job.id} label="แจ้งประกาศไม่เหมาะสมหรือหลอกลวง" /> : null}
        </div>
      </section>
    </>
  );
}
