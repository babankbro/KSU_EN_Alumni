import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDateTime } from "@/lib/server/members";
import { deleteNewsAction, togglePublishAction } from "../../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";

export const metadata = { title: "ข่าวประชาสัมพันธ์" };

type Row = {
  id: number;
  title: string;
  category: string | null;
  published_at: Date | null;
  is_future: boolean;
  is_pinned: boolean;
  updated_at: Date;
  editor: string | null;
};

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  await requireAdmin();
  const { saved, deleted } = await searchParams;

  const rows = await query<Row>(
    `SELECT n.id, n.title, n.category, n.published_at, n.published_at > now() AS is_future,
            n.is_pinned, n.updated_at, u.display_name AS editor
     FROM news n LEFT JOIN admin_user u ON u.id = n.updated_by
     ORDER BY (n.published_at IS NULL) DESC, n.is_pinned DESC, n.published_at DESC NULLS LAST, n.id DESC`,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ข่าวประชาสัมพันธ์</h1>
          <p>ข่าวที่เผยแพร่แล้วจะแสดงที่หน้าแรกและหน้า “ข่าวสาร” ทันที</p>
        </div>
        <Link href="/admin/news/new" className="btn btn-primary">+ เพิ่มข่าว</Link>
      </div>

      {saved ? <p className="flash flash-ok" role="status">บันทึกข่าวเรียบร้อย</p> : null}
      {deleted ? <p className="flash flash-ok" role="status">ลบข่าวแล้ว</p> : null}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">หัวข้อ</th>
              <th scope="col">หมวด</th>
              <th scope="col">สถานะ</th>
              <th scope="col">แก้ไขล่าสุด</th>
              <th scope="col"><span className="sr-only">การจัดการ</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 32 }}>
                  ยังไม่มีข่าว — กด “เพิ่มข่าว” เพื่อเริ่ม
                </td>
              </tr>
            ) : (
              rows.map((n) => {
                const state = !n.published_at ? "draft" : n.is_future ? "scheduled" : "published";
                return (
                  <tr key={n.id}>
                    <td>
                      <Link href={`/admin/news/${n.id}`}><strong>{n.title}</strong></Link>
                      {n.is_pinned ? <span className="small muted"> · 📌 ปักหมุด</span> : null}
                    </td>
                    <td className="small">{n.category ?? "—"}</td>
                    <td>
                      <span className={`pill pill-${state}`}>
                        {state === "draft" ? "ฉบับร่าง" : state === "scheduled" ? "ตั้งเวลา" : "เผยแพร่แล้ว"}
                      </span>
                      {n.published_at ? <div className="small muted">{thaiDateTime(n.published_at)}</div> : null}
                    </td>
                    <td className="small muted">
                      {thaiDateTime(n.updated_at)}
                      {n.editor ? <div>{n.editor}</div> : null}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link href={`/admin/news/${n.id}`} className="btn btn-outline btn-sm">
                          แก้ไข<span className="sr-only"> {n.title}</span>
                        </Link>
                        <form action={togglePublishAction}>
                          <input type="hidden" name="id" value={n.id} />
                          <button type="submit" className="btn btn-outline btn-sm">
                            {n.published_at ? "ยกเลิกเผยแพร่" : "เผยแพร่"}
                          </button>
                        </form>
                        {state === "published" ? (
                          <Link href={`/news/${n.id}`} className="btn btn-outline btn-sm" target="_blank">
                            ดูหน้าเว็บ ↗
                          </Link>
                        ) : null}
                        <form action={deleteNewsAction}>
                          <input type="hidden" name="id" value={n.id} />
                          <ConfirmButton message={`ลบข่าว “${n.title}” ถาวร?`} className="btn btn-danger btn-sm">
                            ลบ
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
