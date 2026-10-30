import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDateTime } from "@/lib/server/members";
import { handlePdpaRequestAction } from "../../data-actions";

export const metadata = { title: "คำขอใช้สิทธิ PDPA" };

const TYPE: Record<string, string> = { access: "ขอเข้าถึง/สำเนาข้อมูล", rectify: "ขอแก้ไขข้อมูล", delete: "ขอลบข้อมูล", withdraw: "ถอนความยินยอม", object: "คัดค้านการประมวลผล" };
const STATUS: Record<string, [string, string]> = { open: ["รอดำเนินการ", "pending"], in_progress: ["กำลังดำเนินการ", "pending"], done: ["เสร็จสิ้น", "verified"], rejected: ["ปฏิเสธ", "rejected"] };
const DONE: Record<string, [string, "ok" | "warn"]> = {
  saved: ["บันทึกและแจ้งผู้ร้องขอแล้ว", "ok"],
  erased: ["ลบข้อมูลส่วนบุคคลแล้ว — เก็บไว้เฉพาะสาขาและปีสำหรับสถิติ", "ok"],
  need_reason: ["การปฏิเสธต้องระบุเหตุผลให้ผู้ร้องขอ", "warn"],
  need_confirm: ["การลบข้อมูลต้องพิมพ์คำว่า “ลบข้อมูล” เพื่อยืนยัน", "warn"],
  invalid: ["คำสั่งไม่ถูกต้อง", "warn"],
};

/**
 * FR-ADM-08 — data-subject requests from /me/data. PDPA s.30 gives 30 days
 * to respond, so the age of each open request is shown prominently.
 */
export default async function PdpaPage({ searchParams }: { searchParams: Promise<{ done?: string; all?: string }> }) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const msg = sp.done ? DONE[sp.done] : undefined;
  const rows = await query<{
    id: number; type: string; detail: string | null; status: string; response: string | null; created_at: Date; handled_at: Date | null;
    alumni_id: string | null; name: string | null; email: string | null; age_days: number; handler: string | null;
  }>(
    `SELECT r.id, r.type::text AS type, r.detail, r.status::text AS status, r.response, r.created_at, r.handled_at, r.alumni_id,
            a.first_name_th || ' ' || a.last_name_th AS name, ac.email, extract(day FROM now() - r.created_at)::int AS age_days,
            u.display_name AS handler
     FROM pdpa_request r LEFT JOIN alumni a ON a.id = r.alumni_id LEFT JOIN account ac ON ac.id = r.account_id
     LEFT JOIN admin_user u ON u.id = r.handled_by
     ${sp.all ? "" : "WHERE r.status IN ('open', 'in_progress')"}
     ORDER BY r.created_at`,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>คำขอใช้สิทธิของเจ้าของข้อมูล</h1>
          <p>ต้องตอบภายใน 30 วันนับจากวันที่ได้รับคำขอ · <Link href={sp.all ? "/admin/pdpa" : "/admin/pdpa?all=1"}>{sp.all ? "แสดงเฉพาะที่ค้างอยู่" : "แสดงทั้งหมด"}</Link></p>
        </div>
      </div>
      {msg ? <p className={`flash flash-${msg[1]}`} role={msg[1] === "ok" ? "status" : "alert"}>{msg[0]}</p> : null}
      {rows.length === 0 ? <p className="admin-card muted">ไม่มีคำขอค้าง</p> : null}

      {rows.map((r) => (
        <section key={r.id} id={`r${r.id}`} className="admin-card mod-item">
          <p className="small muted" style={{ margin: 0 }}>
            <span className={`pill pill-${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span> · {thaiDateTime(r.created_at)}
            {["open", "in_progress"].includes(r.status) ? (
              <strong style={{ color: r.age_days >= 25 ? "var(--color-error)" : undefined }}> · ผ่านมา {r.age_days} วัน</strong>
            ) : r.handled_at ? ` · ดำเนินการโดย ${r.handler ?? "—"} ${thaiDateTime(r.handled_at)}` : ""}
          </p>
          <h2 style={{ margin: "8px 0 4px", fontSize: 18 }}>{TYPE[r.type]} — {r.alumni_id ? <Link href={`/admin/members/${r.alumni_id}`}>{r.name}</Link> : "ไม่ทราบชื่อ"}</h2>
          <p className="small">{r.email ?? ""}</p>
          {r.detail ? <p className="mod-body">{r.detail}</p> : null}
          {r.response ? <p className="small">คำตอบ: {r.response}</p> : null}
          {r.type === "access" ? <p className="small muted">เจ้าของข้อมูลดาวน์โหลดสำเนาข้อมูลของตนเองได้ทันทีที่หน้า “ข้อมูลของฉัน” — ใช้คำขอนี้กรณีต้องการเอกสารรับรอง</p> : null}
          {r.type === "withdraw" ? <p className="small muted">การถอนความยินยอมแสดงในทำเนียบและรับข่าวสารมีผลทันทีเมื่อส่งคำขอแล้ว</p> : null}

          {["open", "in_progress"].includes(r.status) ? (
            <form action={handlePdpaRequestAction} className="mod-form">
              <input type="hidden" name="requestId" value={r.id} />
              <div className="field">
                <label htmlFor={`resp${r.id}`}>ข้อความถึงผู้ร้องขอ</label>
                <textarea id={`resp${r.id}`} name="response" rows={2} maxLength={2000} />
              </div>
              {r.type === "delete" && r.alumni_id ? (
                <div className="flash flash-warn">
                  <label className="check-row"><input type="checkbox" name="erase" /> <span><strong>ลบข้อมูลส่วนบุคคลถาวร</strong> (ชื่อ ติดต่อ ประวัติการทำงาน รูป ข่าว บัญชี) — ย้อนกลับไม่ได้</span></label>
                  <label htmlFor={`ce${r.id}`} className="small">พิมพ์ “ลบข้อมูล” เพื่อยืนยัน</label>
                  <input id={`ce${r.id}`} name="confirmErase" autoComplete="off" />
                </div>
              ) : null}
              <div className="review-actions">
                <button type="submit" name="status" value="done" className="btn btn-primary">เสร็จสิ้น</button>
                <button type="submit" name="status" value="in_progress" className="btn btn-outline">กำลังดำเนินการ</button>
                <button type="submit" name="status" value="rejected" className="btn btn-danger">ปฏิเสธ (ระบุเหตุผล)</button>
              </div>
            </form>
          ) : null}
        </section>
      ))}
    </>
  );
}
