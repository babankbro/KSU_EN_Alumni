import type { Alumni } from "@/lib/types";
import Image from "next/image";
import { currentJob, fullName, initials, programName } from "@/lib/data";
import FreshnessBadge from "./FreshnessBadge";
import PrivacyLock from "./PrivacyLock";

/**
 * A single row in the alumni directory (FR-DIR-04).
 *
 * `isAuthenticated` is threaded through explicitly so the privacy rule is
 * visible at every call site rather than buried in a global (FR-DIR-06).
 */
export default function PersonCard({
  person,
  isAuthenticated = false,
}: {
  person: Alumni;
  isAuthenticated?: boolean;
}) {
  const job = currentJob(person);
  const contactHidden = !isAuthenticated || person.contact.visibility === "private";

  return (
    <article className="person">
      {person.imageSrc ? (
        <Image
          className="portrait portrait-sm portrait-photo"
          src={person.imageSrc}
          alt=""
          width={104}
          height={104}
          sizes="52px"
        />
      ) : (
        <div className="portrait portrait-sm" aria-hidden="true">
          {initials(person)}
        </div>
      )}
      <div className="person-body">
        <h4>{fullName(person)}</h4>
        <p className="meta">
          รุ่น {person.admissionYear} · {programName(person.programId)}
        </p>
        {job ? (
          <p className="job">
            {job.position} · {job.organization}
            {person.contact.province ? ` · ${person.contact.province}` : ""}
          </p>
        ) : (
          <p className="job">ยังไม่ระบุข้อมูลการทำงาน</p>
        )}

        {person.skills.length > 0 ? (
          <div className="skills">
            {person.skills.map((s) => (
              <span className="skill" key={s}>
                {s}
              </span>
            ))}
          </div>
        ) : null}

        <FreshnessBadge updatedAt={person.profileUpdatedAt} />

        {contactHidden ? (
          <PrivacyLock
            label={
              person.contact.visibility === "private"
                ? "เจ้าของข้อมูลตั้งค่าไม่เปิดเผยข้อมูลติดต่อ"
                : "เข้าสู่ระบบเพื่อดูข้อมูลติดต่อ"
            }
          />
        ) : null}
      </div>
    </article>
  );
}
