import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import { thaiDateTime } from "@/lib/server/members";
import { decideNominationAction } from "../../../award-actions";

export const metadata = { title: "พิจารณาการเสนอชื่อ" };

const STATUS: Record<string, string> = { submitted: "รอพิจารณา", shortlisted: "ผ่านเข้ารอบ", awarded: "ได้รับรางวัล", not_selected: "ไม่ได้รับเลือก" };

/** FR-AWD-03 — the committee reads each nomination and records a decision. */
export default async function AwardRoundPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const session = await requireAdmin(["admin", "faculty"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [round] = await query<{ title: string; description: string | null; closes_at: Date }>(`SELECT title, description, closes_at FROM award_round WHERE id = $1`, [id]);
  if (!round) notFound();
  const { done } = await searchParams;

  const noms = await query<{
    id: number; nominee_name: string; nominee_alumni_id: string | null; nominee_detail: string | null; reason: string;
    evidence_file_id: string | null; status: string; committee_note: string | null; citation: string | null;
    nominator: string | null; created_at: Date; decided_at: Date | null; decider: string | null; cohort: number | null; program: string | null;
  }>(
    `SELECT n.id, n.nominee_name, n.nominee_alumni_id, n.nominee_detail, n.reason, n.evidence_file_id, n.status, n.committee_note,
            n.citation, ac.display_name AS nominator, n.created_at, n.decided_at, u.display_name AS decider,
            a.admission_year AS cohort, pr.name_th AS program
     FROM award_nomination n
     LEFT JOIN account ac ON ac.id = n.nominator_account_id
     LEFT JOIN admin_user u ON u.id = n.decided_by
     LEFT JOIN alumni a ON a.id = n.nominee_alumni_id
     LEFT JOIN program_resolved pr ON pr.id = a.program_id
     WHERE n.round_id = $1
     ORDER BY CASE n.status WHEN 'shortlisted' THEN 0 WHEN 'submitted' THEN 1 WHEN 'awarded' THEN 2 ELSE 3 END, n.created_at`,
    [id],
  );

  return (
    <>
      <p className="small"><Link href="/admin/awards">← รอบทั้งหมด</Link></p>
      <div className="admin-head">
        <div>
          <h1>{round.title}</h1>
          <p>{noms.length} การเสนอชื่อ · ปิดรับ {thaiDateTime(round.closes_at)}</p>
        </div>
      </div>
      {done === "saved" ? <p className="flash flash-ok" role="status">บันทึกผลการพิจารณาแล้ว</p> : null}
      {done === "need_citation" ? <p className="flash flash-warn" role="alert">กรุณาเขียนคำประกาศเกียรติคุณก่อนบันทึกว่าได้รับรางวัล — ข้อความนี้จะแสดงบนเว็บไซต์</p> : null}

      {noms.length === 0 ? <p className="admin-card muted">ยังไม่มีการเสนอชื่อในรอบนี้</p> : null}
      {noms.map((n) => (
        <section key={n.id} id={`n${n.id}`} className="admin-card mod-item">
          <p className="small muted" style={{ margin: 0 }}>
            <span className="pill">{STATUS[n.status]}</span> · เสนอโดย {n.nominator ?? "—"} · {thaiDateTime(n.created_at)}
            {n.decided_at ? ` · ตัดสินโดย ${n.decider ?? "—"} ${thaiDateTime(n.decided_at)}` : ""}
          </p>
          <h2 style={{ margin: "8px 0 4px" }}>
            {n.nominee_alumni_id && session.role === "admin" ? <Link href={`/admin/members/${n.nominee_alumni_id}`}>{n.nominee_name}</Link> : n.nominee_name}
          </h2>
          <p className="small">
            {n.cohort ? `รุ่น ${n.cohort} · ${n.program} · ` : ""}{n.nominee_detail ?? (n.nominee_alumni_id ? "" : "ไม่ได้เลือกจากทำเนียบ")}
          </p>
          <p className="mod-body">{n.reason}</p>
          {n.evidence_file_id ? <p><a href={fileUrl(n.evidence_file_id)} target="_blank" rel="noopener">📎 เอกสารประกอบ</a></p> : null}

          <form action={decideNominationAction} className="mod-form">
            <input type="hidden" name="nominationId" value={n.id} />
            <div className="field narrow">
              <label htmlFor={`s${n.id}`}>ผลการพิจารณา</label>
              <select id={`s${n.id}`} name="status" defaultValue={n.status}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`c${n.id}`}>คำประกาศเกียรติคุณ (แสดงบนเว็บเมื่อได้รับรางวัล)</label>
              <textarea id={`c${n.id}`} name="citation" rows={2} maxLength={500} defaultValue={n.citation ?? ""} />
            </div>
            <div className="field">
              <label htmlFor={`m${n.id}`}>บันทึกของกรรมการ (ภายใน)</label>
              <textarea id={`m${n.id}`} name="committeeNote" rows={2} maxLength={2000} defaultValue={n.committee_note ?? ""} />
            </div>
            <div className="review-actions"><button type="submit" className="btn btn-primary">บันทึกผล</button></div>
          </form>
        </section>
      ))}
    </>
  );
}
