import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import NewsForm from "@/components/admin/NewsForm";

export const metadata = { title: "เพิ่มข่าว" };

export default async function NewNewsPage() {
  await requireAdmin(["admin", "editor"]);
  return (
    <>
      <p className="small"><Link href="/admin/news">← ข่าวทั้งหมด</Link></p>
      <div className="admin-head"><h1>เพิ่มข่าว</h1></div>
      <NewsForm
        initial={{
          title: "", summary: "", body: "", category: "ข่าวคณะ", isPinned: false,
          publishMode: "draft", publishAt: "", coverUrl: null, tags: "",
        }}
      />
    </>
  );
}
