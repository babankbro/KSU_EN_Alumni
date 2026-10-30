import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { JobEditor } from "../../activity/editors";
import { deleteJobAction } from "../../activity/actions";

export const metadata = { title: "แก้ไขประกาศงาน" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const acc = await requireMember({ alumni: true, verified: true });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [j] = await query<{
    id: number; title: string; organization: string; type: string; location: string | null; province: string | null;
    description: string | null; closes_at: string | null; apply_url: string | null; contact_email: string | null;
    moderation_status: string; moderation_note: string | null; programs: number[]; skills: string[];
  }>(
    `SELECT j.id, j.title, j.organization, j.employment_type::text AS type, j.location, j.province, j.description,
            to_char(j.closes_at, 'YYYY-MM-DD') AS closes_at, j.apply_url, j.contact_email, j.moderation_status::text AS moderation_status,
            j.moderation_note,
            coalesce((SELECT array_agg(program_id) FROM job_post_program WHERE job_post_id = j.id), '{}') AS programs,
            coalesce((SELECT array_agg(s.name) FROM job_post_skill x JOIN skill s ON s.id = x.skill_id WHERE x.job_post_id = j.id), '{}') AS skills
     FROM job_post j WHERE j.id = $1 AND j.posted_by = $2`,
    [id, acc.alumniId],
  );
  if (!j) notFound();

  return (
    <>
      <p className="small"><Link href="/me/activity">← กิจกรรม งาน บทความ</Link></p>
      <div className="admin-head"><h1>แก้ไขประกาศงาน</h1></div>
      {j.moderation_note && j.moderation_status !== "approved" ? (
        <p className="flash flash-warn" role="status"><strong>ความเห็นจากผู้ตรวจสอบ:</strong> {j.moderation_note}</p>
      ) : null}
      {j.moderation_status === "hidden" ? (
        <p className="muted">ประกาศนี้ถูกซ่อนโดยผู้ตรวจสอบ จึงแก้ไขไม่ได้</p>
      ) : (
        <JobEditor
          job={{
            id: j.id, title: j.title, organization: j.organization, type: j.type, location: j.location, province: j.province,
            description: j.description, closesAt: j.closes_at, applyUrl: j.apply_url, contactEmail: j.contact_email,
            programIds: j.programs, skills: j.skills,
          }}
        />
      )}
      <form action={deleteJobAction} className="admin-card danger-zone">
        <input type="hidden" name="recordId" value={j.id} />
        <h2>ลบประกาศ</h2>
        <ConfirmButton message="ลบประกาศงานนี้?" className="btn btn-danger btn-sm">ลบประกาศ</ConfirmButton>
      </form>
    </>
  );
}
