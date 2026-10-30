import Link from "next/link";
import { requireMember } from "@/lib/server/member-auth";
import { ArticleEditor } from "../../activity/editors";

export const metadata = { title: "เขียนบทความ" };

export default async function NewArticlePage() {
  await requireMember({ alumni: true, verified: true });
  return (
    <>
      <p className="small"><Link href="/me/activity">← กิจกรรม งาน บทความ</Link></p>
      <div className="admin-head"><h1>เขียนบทความแบ่งปันประสบการณ์</h1></div>
      <ArticleEditor />
    </>
  );
}
