import type { JobPost } from "@/lib/types";
import { formatThaiDate } from "@/lib/format";
import { alumniById } from "@/lib/data";

/**
 * Visual Design §5.9 — position, organisation, type, location, closing date,
 * plus a soft-gold badge when the opening was shared by an alumnus.
 */
export default function JobCard({ job }: { job: JobPost }) {
  const poster = job.postedByAlumniId ? alumniById(job.postedByAlumniId) : undefined;

  return (
    <article className="card job-card">
      <div className="card-body">
        {poster ? (
          <span className="badge badge-alumni-posted">โพสต์โดยศิษย์เก่า</span>
        ) : null}
        <h3>{job.title}</h3>
        <p className="job-org">{job.organization}</p>
        <p className="job-facts">
          {job.employmentType} · {job.location}
          <br />
          ปิดรับ {formatThaiDate(job.closesAt)}
        </p>
        <div className="skills">
          {job.requiredSkills.map((s) => (
            <span className="skill" key={s}>
              {s}
            </span>
          ))}
        </div>
        <div className="card-foot">
          <a href="#" className="link-arrow">
            ดูรายละเอียด →
          </a>
        </div>
      </div>
    </article>
  );
}
