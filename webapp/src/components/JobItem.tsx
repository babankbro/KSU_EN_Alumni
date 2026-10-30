import Link from "next/link";
import type { JobCardData } from "@/lib/server/jobs";
import { formatThaiDateOnly } from "@/lib/server/format-server";

/**
 * Visual Design §5.9 — position, organisation, type, location, closing date,
 * plus a soft-gold badge when the opening was shared by an alumnus.
 */
export default function JobItem({ job }: { job: JobCardData }) {
  return (
    <article className="card job-card">
      <div className="card-body">
        {job.postedByAlumni ? <span className="badge badge-alumni-posted">โพสต์โดยศิษย์เก่า</span> : null}
        <h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3>
        <p className="job-org">{job.organization}</p>
        <p className="job-facts">
          {job.type} · {job.location ?? job.province ?? "ไม่ระบุสถานที่"}
          <br />
          {job.closesAt ? `ปิดรับ ${formatThaiDateOnly(job.closesAt)}` : "เปิดรับจนกว่าจะได้คน"}
        </p>
        {job.skills.length ? (
          <div className="skills">
            {job.skills.map((s) => <span className="skill" key={s}>{s}</span>)}
          </div>
        ) : null}
        <div className="card-foot">
          <Link href={`/jobs/${job.id}`} className="link-arrow">ดูรายละเอียด →</Link>
        </div>
      </div>
    </article>
  );
}
