import Link from "next/link";
import type { DirectoryPerson } from "@/lib/server/directory";
import { formatThaiDateOnly } from "@/lib/server/format-server";

/**
 * One alumnus in the directory (FR-DIR-04). Every personal field arrives
 * already filtered for the viewer by toPerson(); this component only renders
 * what it is given and says why the rest is missing (FR-DIR-06).
 */
export default function DirectoryCard({ p, signedIn }: { p: DirectoryPerson; signedIn: boolean }) {
  const contact = [p.email, p.phone, p.lineId ? `LINE ${p.lineId}` : null].filter(Boolean);
  return (
    <article className="person">
      {p.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="portrait portrait-sm portrait-photo" src={p.photoUrl} alt="" width={52} height={52} />
      ) : (
        <div className="portrait portrait-sm" aria-hidden="true">
          {p.name.replace(/^(นาย|นางสาว|นาง)/, "").slice(0, 2)}
        </div>
      )}
      <div className="person-body">
        <h4>
          <Link href={`/directory/${p.id}`}>{p.name}</Link>
          {p.nickname ? <span className="muted" style={{ fontWeight: 400 }}> ({p.nickname})</span> : null}
          {p.isNotable ? <span className="badge badge-alumni-posted" style={{ marginLeft: 6 }}>ศิษย์เก่าดีเด่น</span> : null}
        </h4>
        <p className="meta">
          รุ่น {p.admissionYear} · {p.level} {p.program}
          {p.program !== p.programCurrent ? ` (ปัจจุบัน: ${p.programCurrent})` : ""}
        </p>
        {p.position || p.organization ? (
          <p className="job">
            {[p.position, p.organization, p.province].filter(Boolean).join(" · ")}
          </p>
        ) : p.province ? (
          <p className="job">{p.province}</p>
        ) : null}

        {p.skills.length ? (
          <div className="skills">
            {p.skills.slice(0, 5).map((s) => (
              <span className="skill" key={s}>{s}</span>
            ))}
          </div>
        ) : null}

        <p className="freshness">
          <span className={p.stale ? "badge badge-stale" : "badge badge-fresh"}>{p.stale ? "ควรอัปเดต" : "ข้อมูลเป็นปัจจุบัน"}</span>
          <span className="updated-on">อัปเดตเมื่อ {formatThaiDateOnly(p.profileUpdatedAt)}</span>
        </p>

        {contact.length ? (
          <p className="small" style={{ margin: "8px 0 0" }}>{contact.join(" · ")}</p>
        ) : p.hiddenContact ? (
          <p className="locked">🔒 {signedIn ? "เจ้าของข้อมูลไม่เปิดเผยข้อมูลติดต่อ" : "เข้าสู่ระบบเพื่อดูข้อมูลติดต่อ"}</p>
        ) : null}
      </div>
    </article>
  );
}
