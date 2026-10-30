import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/PageHead";
import { getDirectoryPerson } from "@/lib/server/directory";
import { getViewer, isMember, viewerAccount } from "@/lib/server/member-auth";
import { postsAboutPerson } from "@/lib/server/posts";
import { hit, LIMITS } from "@/lib/server/rate-limit";
import { query } from "@/lib/server/db";
import { formatThaiDateOnly } from "@/lib/server/format-server";

export const metadata: Metadata = { title: "โปรไฟล์ศิษย์เก่า", robots: { index: false } };

export default async function DirectoryProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const account = viewerAccount(viewer);

  // FR-DIR-09 — profile views per account; anonymous views share the site ceiling.
  if (account ? await hit(LIMITS.profileView, account.id) : await hit(LIMITS.directoryAnon, "all")) {
    return (
      <section className="section"><div className="wrap">
        <p className="flash flash-warn" role="alert">มีการเปิดดูโปรไฟล์ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่</p>
      </div></section>
    );
  }

  const p = await getDirectoryPerson(id, viewer);
  if (!p) notFound();

  // FR-DIR-08 — who viewed whose profile, when.
  const actor = viewer.kind === "staff" ? viewer.staff.id : account ? `account:${account.id}` : "anonymous";
  await query(
    `INSERT INTO audit_log (actor, action, target_table, target_id) VALUES ($1, 'directory.profile_view', 'alumni', $2)`,
    [actor, p.id],
  );

  // FR-ANEWS-19 — posts by or tagging this person, each filtered by its own visibility.
  const posts = await postsAboutPerson(p.id, viewer);
  const member = isMember(viewer);

  const contact = [
    p.email ? { k: "อีเมล", v: <a href={`mailto:${p.email}`}>{p.email}</a> } : null,
    p.phone ? { k: "โทรศัพท์", v: <a href={`tel:${p.phone}`}>{p.phone}</a> } : null,
    p.lineId ? { k: "LINE", v: p.lineId } : null,
  ].filter(Boolean) as { k: string; v: React.ReactNode }[];

  return (
    <>
      <PageHead crumb="ทำเนียบศิษย์เก่า" title={p.name} lead={`รุ่น ${p.admissionYear} · ${p.level} ${p.program}`} />
      <section className="section">
        <div className="wrap" style={{ maxWidth: 900 }}>
          <p className="small"><Link href="/directory">← กลับไปทำเนียบ</Link></p>

          <div className="admin-card">
            <div className="member-head">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="member-photo" src={p.photoUrl} alt={`รูปโปรไฟล์ ${p.name}`} />
              ) : (
                <div className="member-photo-ph" aria-hidden="true">{p.name.replace(/^(นาย|นางสาว|นาง)/, "").slice(0, 2)}</div>
              )}
              <div>
                <h2 style={{ margin: 0 }}>
                  {p.name}{p.nickname ? <span className="muted" style={{ fontWeight: 400 }}> ({p.nickname})</span> : null}
                </h2>
                <p style={{ margin: "4px 0 0" }}>
                  <span className={p.stale ? "badge badge-stale" : "badge badge-fresh"}>{p.stale ? "ควรอัปเดต" : "ข้อมูลเป็นปัจจุบัน"}</span>{" "}
                  <span className="small muted">อัปเดตเมื่อ {formatThaiDateOnly(p.profileUpdatedAt)}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <section className="admin-card">
              <h2>การศึกษาและการทำงาน</h2>
              <dl className="kv">
                <dt>สาขา</dt>
                <dd>{p.level} {p.program}{p.program !== p.programCurrent ? ` (ปัจจุบัน: ${p.programCurrent})` : ""}</dd>
                <dt>รุ่น / ปีที่จบ</dt><dd>{p.admissionYear} / {p.graduationYear ?? "—"}</dd>
                {p.position || p.organization ? (<><dt>งานปัจจุบัน</dt><dd>{[p.position, p.organization].filter(Boolean).join(" · ")}</dd></>) : null}
                {p.province ? (<><dt>จังหวัด</dt><dd>{p.province}</dd></>) : null}
                {p.formerNames.length ? (<><dt>ชื่อเดิม</dt><dd>{p.formerNames.join(", ")}</dd></>) : null}
              </dl>
              {p.skills.length ? (
                <div className="skills" style={{ marginTop: 12 }}>{p.skills.map((s) => <span key={s} className="skill">{s}</span>)}</div>
              ) : null}
            </section>

            <section className="admin-card">
              <h2>ติดต่อ</h2>
              {contact.length ? (
                <dl className="kv">{contact.map((c) => (<div key={c.k} style={{ display: "contents" }}><dt>{c.k}</dt><dd>{c.v}</dd></div>))}</dl>
              ) : p.hiddenContact ? (
                <p className="locked">🔒 {viewer.kind === "anonymous" ? "เข้าสู่ระบบเพื่อดูข้อมูลติดต่อ" : member ? "เจ้าของข้อมูลไม่เปิดเผยข้อมูลติดต่อ" : "ข้อมูลติดต่อเห็นได้เฉพาะศิษย์เก่าที่ยืนยันตัวตนแล้ว"}</p>
              ) : (
                <p className="muted">ไม่มีข้อมูลติดต่อ</p>
              )}
            </section>
          </div>

          {posts.length ? (
            <section className="admin-card">
              <h2>ข่าวที่เกี่ยวข้องกับ{p.name.replace(/^(นาย|นางสาว|นาง)/, "")}</h2>
              <ul className="list-plain">
                {posts.map((x) => (
                  <li key={x.id}>
                    <Link href={`/alumni-news/${x.id}`}>{x.title}</Link>{" "}
                    <span className="small muted">· {x.type} · {formatThaiDateOnly(x.publishedAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </section>
    </>
  );
}
