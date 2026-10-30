import Link from "next/link";
import { notFound } from "next/navigation";
import { audit, requireAdmin } from "@/lib/server/auth";
import { CLAIM_STATUS_LABEL, getMember, thaiDate, thaiDateTime } from "@/lib/server/members";
import { reviewMemberAction } from "../../../actions";

export const metadata = { title: "ข้อมูลสมาชิก" };

const VISIBILITY_LABEL: Record<string, string> = {
  public: "สาธารณะ",
  members: "เฉพาะสมาชิก",
  private: "ไม่เปิดเผย",
};
const CONSENT_LABEL: Record<string, string> = {
  data_processing: "จัดเก็บและใช้ข้อมูล",
  directory_listing: "แสดงในทำเนียบศิษย์เก่า",
  news: "รับข่าวสาร",
};
const REQUEST_STATUS: Record<string, string> = {
  submitted: "รอตรวจสอบ",
  matched: "จับคู่ระเบียนได้",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reviewed?: string; stale?: string }>;
};

export default async function MemberDetailPage({ params, searchParams }: Props) {
  const session = await requireAdmin(["admin", "faculty"]);
  const canReview = session.role === "admin";
  const { id } = await params;
  const { reviewed, stale } = await searchParams;

  const m = await getMember(id);
  if (!m) notFound();

  // FR-DIR-08 — every look at a member's personal data is recorded.
  await audit(session, "member.view", "alumni", m.id);

  // Latest decision per consent purpose
  const latestConsent = new Map<string, (typeof m.consents)[number]>();
  for (const c of m.consents) if (!latestConsent.has(c.purpose)) latestConsent.set(c.purpose, c);

  return (
    <>
      <p className="small">
        <Link href="/admin/members">← รายชื่อสมาชิก</Link>
      </p>

      {reviewed ? (
        <p className="flash flash-ok" role="status">
          {reviewed === "approve" ? "อนุมัติสมาชิกเรียบร้อย" : "บันทึกผลไม่อนุมัติเรียบร้อย"}
        </p>
      ) : null}
      {stale ? (
        <p className="flash flash-warn" role="alert">
          สถานะของสมาชิกนี้เปลี่ยนไปแล้วก่อนที่คุณจะกดยืนยัน — ตรวจสอบข้อมูลล่าสุดด้านล่าง
        </p>
      ) : null}

      <div className="admin-card">
        <div className="member-head">
          {m.photoUrl ? (
            // Served by /api/files with an admin session check.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="member-photo" src={m.photoUrl} alt={`รูปโปรไฟล์ ${m.firstNameTh} ${m.lastNameTh}`} />
          ) : (
            <div className="member-photo-ph" aria-hidden="true">{m.firstNameTh.slice(0, 2)}</div>
          )}
          <div>
            <h1 style={{ fontSize: 26, margin: 0 }}>
              {m.titleTh}{m.firstNameTh} {m.lastNameTh}
              {m.nickname ? <span className="muted" style={{ fontWeight: 400 }}> ({m.nickname})</span> : null}
            </h1>
            <p style={{ margin: "4px 0 0" }}>
              <span className={`pill pill-${m.status}`}>{CLAIM_STATUS_LABEL[m.status]}</span>{" "}
              <span className="muted small">
                {m.level} {m.program} · รุ่น {m.admissionYear}
              </span>
            </p>
          </div>
        </div>
      </div>

      {m.status === "pending" && canReview ? (
        <section className="admin-card review-box" aria-labelledby="review-h">
          <h2 id="review-h">ใบสมัครนี้รอการตรวจสอบ</h2>
          <p className="small" style={{ margin: 0 }}>
            ตรวจชื่อ รุ่น และสาขากับเอกสารของงานทะเบียนก่อนอนุมัติ
            {!m.programVerified ? " — ชื่อสาขานี้ยังไม่ได้ยืนยันกับงานทะเบียน" : ""}
          </p>
          <form action={reviewMemberAction}>
            <input type="hidden" name="alumniId" value={m.id} />
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="note">หมายเหตุ (ไม่บังคับ — จะบันทึกไว้กับใบสมัคร)</label>
              <textarea id="note" name="note" rows={2} maxLength={500} />
            </div>
            <div className="review-actions">
              <button type="submit" name="decision" value="approve" className="btn btn-primary">
                ✓ อนุมัติเป็นสมาชิก
              </button>
              <button type="submit" name="decision" value="reject" className="btn btn-danger">
                ไม่อนุมัติ
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="admin-grid-2">
        <section className="admin-card">
          <h2>ข้อมูลส่วนตัว</h2>
          <dl className="kv">
            <dt>รหัสนักศึกษา</dt><dd>{m.studentCode ?? "—"}</dd>
            <dt>ชื่อภาษาอังกฤษ</dt><dd>{[m.firstNameEn, m.lastNameEn].filter(Boolean).join(" ") || "—"}</dd>
            <dt>ชื่อ-นามสกุลเดิม</dt><dd>{m.formerNames.length ? m.formerNames.join(", ") : "—"}</dd>
            <dt>วันเกิด</dt><dd>{thaiDate(m.birthDate)}</dd>
            <dt>ความสมบูรณ์ของโปรไฟล์</dt><dd>{m.completeness}%</dd>
            <dt>ยืนยันตัวตนเมื่อ</dt><dd>{thaiDateTime(m.claimedAt)}</dd>
            <dt>อัปเดตข้อมูลล่าสุด</dt><dd>{thaiDateTime(m.profileUpdatedAt)}</dd>
          </dl>
        </section>

        <section className="admin-card">
          <h2>การศึกษา</h2>
          <dl className="kv">
            <dt>ระดับ</dt><dd>{m.level}</dd>
            <dt>สาขา (ตามที่เรียน)</dt><dd>{m.program}</dd>
            {m.program !== m.programCurrent ? (<><dt>ชื่อสาขาปัจจุบัน</dt><dd>{m.programCurrent}</dd></>) : null}
            <dt>ยืนยันชื่อสาขากับทะเบียน</dt><dd>{m.programVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}</dd>
            <dt>ปีที่เข้าศึกษา</dt><dd>{m.admissionYear}</dd>
            <dt>ปีที่สำเร็จการศึกษา</dt><dd>{m.graduationYear ?? "—"}</dd>
          </dl>
        </section>

        <section className="admin-card">
          <h2>ข้อมูลติดต่อ</h2>
          {m.contact ? (
            <dl className="kv">
              <dt>อีเมล</dt><dd>{m.contact.email ?? "—"}</dd>
              <dt>โทรศัพท์</dt><dd>{m.contact.phone ?? "—"}</dd>
              <dt>LINE</dt><dd>{m.contact.lineId ?? "—"}</dd>
              <dt>จังหวัด</dt><dd>{m.contact.province ?? "—"}</dd>
              <dt>การเปิดเผยข้อมูล</dt><dd>{VISIBILITY_LABEL[m.contact.visibility] ?? m.contact.visibility}</dd>
            </dl>
          ) : (
            <p className="muted">ยังไม่มีข้อมูลติดต่อ</p>
          )}
        </section>

        <section className="admin-card">
          <h2>ความยินยอม (PDPA)</h2>
          {latestConsent.size === 0 ? (
            <p className="muted">ไม่มีบันทึกความยินยอม</p>
          ) : (
            <dl className="kv">
              {[...latestConsent.values()].map((c) => (
                <div key={c.purpose} style={{ display: "contents" }}>
                  <dt>{CONSENT_LABEL[c.purpose] ?? c.purpose}</dt>
                  <dd>
                    {c.granted ? "✓ ยินยอม" : "✗ ไม่ยินยอม"}
                    <span className="small muted"> · {thaiDate(c.recordedAt)} · นโยบาย {c.policyVersion}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section className="admin-card">
        <h2>ประวัติการทำงาน</h2>
        {m.employment.length === 0 ? (
          <p className="muted">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>องค์กร</th><th>ตำแหน่ง</th><th>ภาค</th><th>เริ่ม</th><th></th></tr>
              </thead>
              <tbody>
                {m.employment.map((e, i) => (
                  <tr key={i}>
                    <td>{e.organization}</td>
                    <td>{e.position}</td>
                    <td>{e.sector ?? "—"}</td>
                    <td>{thaiDate(e.start)}</td>
                    <td>{e.isCurrent ? <span className="pill pill-verified">ปัจจุบัน</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {m.skills.length ? <p className="small" style={{ marginTop: 12 }}>ทักษะ: {m.skills.join(", ")}</p> : null}
      </section>

      <section className="admin-card">
        <h2>ใบสมัคร</h2>
        {m.requests.length === 0 ? (
          <p className="muted">ระเบียนนี้นำเข้าจากงานทะเบียน ไม่มีใบสมัครผ่านเว็บ</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ส่งเมื่อ</th><th>รูปแบบ</th><th>สถานะ</th><th>หมายเหตุ</th><th>ตรวจเมื่อ</th></tr>
              </thead>
              <tbody>
                {m.requests.map((r) => (
                  <tr key={r.id}>
                    <td>{thaiDateTime(r.createdAt)}</td>
                    <td>{r.path === "claim" ? "Claim ระเบียนเดิม" : "สมัครใหม่"}</td>
                    <td>{REQUEST_STATUS[r.status] ?? r.status}</td>
                    <td className="small">{r.note ?? "—"}</td>
                    <td className="small">{thaiDateTime(r.reviewedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
