import Link from "next/link";
import { requireMember } from "@/lib/server/member-auth";
import { JobEditor } from "../../activity/editors";

export const metadata = { title: "ประกาศงาน" };

export default async function NewJobPage() {
  await requireMember({ alumni: true, verified: true });
  return (
    <>
      <p className="small"><Link href="/me/activity">← กิจกรรม งาน บทความ</Link></p>
      <div className="admin-head"><h1>ประกาศงานหรือที่ฝึกงาน</h1></div>
      <JobEditor />
    </>
  );
}
