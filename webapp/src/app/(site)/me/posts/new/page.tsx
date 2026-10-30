import Link from "next/link";
import { requireMember } from "@/lib/server/member-auth";
import PostEditor from "../PostEditor";

export const metadata = { title: "ส่งข่าว" };

export default async function NewPostPage() {
  const acc = await requireMember({ alumni: true, verified: true });
  return (
    <>
      <p className="small"><Link href="/me/posts">← ข่าวของฉัน</Link></p>
      <div className="admin-head"><h1>ส่งข่าวของศิษย์เก่า</h1></div>
      <PostEditor trusted={acc.isTrustedPoster} />
    </>
  );
}
