import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { getEvent, listEventItems } from "@/lib/server/events";
import { thaiDateTime } from "@/lib/server/members";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import ConfirmButton from "@/components/admin/ConfirmButton";
import EventForm from "../EventForm";
import { addItemAction, deleteEventAction, setOrderStatusAction, toggleItemAction } from "../../../event-actions";

export const metadata = { title: "แก้ไขกิจกรรม" };

const ORDER_STATUS: Record<string, string> = { reserved: "จองแล้ว", paid: "ชำระแล้ว", delivered: "รับของแล้ว", cancelled: "ยกเลิก" };

export default async function AdminEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin(["admin", "editor"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const e = await getEvent(id, { includeDrafts: true });
  if (!e) notFound();
  const { saved } = await searchParams;

  const [registrants, items, orders] = await Promise.all([
    query<{ name: string; cohort: number; program: string; email: string | null; registered_at: Date; cancelled_at: Date | null }>(
      `SELECT a.title_th || a.first_name_th || ' ' || a.last_name_th AS name, a.admission_year AS cohort, pr.name_th AS program,
              c.email, r.registered_at, r.cancelled_at
       FROM event_registration r JOIN alumni a ON a.id = r.alumni_id JOIN program_resolved pr ON pr.id = a.program_id
       LEFT JOIN alumni_contact c ON c.alumni_id = a.id
       WHERE r.event_id = $1 ORDER BY r.cancelled_at NULLS FIRST, r.registered_at`,
      [id],
    ),
    listEventItems(id, false),
    query<{ id: number; item: string; option: string | null; quantity: number; status: string; name: string; created_at: Date }>(
      `SELECT o.id, i.name AS item, o.option, o.quantity, o.status, a.first_name_th || ' ' || a.last_name_th AS name, o.created_at
       FROM event_order o JOIN event_item i ON i.id = o.item_id JOIN alumni a ON a.id = o.alumni_id
       WHERE i.event_id = $1 ORDER BY o.created_at DESC`,
      [id],
    ),
  ]);
  const active = registrants.filter((r) => !r.cancelled_at);

  return (
    <>
      <p className="small"><Link href="/admin/events">← กิจกรรมทั้งหมด</Link></p>
      <div className="admin-head">
        <div>
          <h1>{e.title}</h1>
          <p>{thaiDateTime(e.startsAt)} · ลงทะเบียน {active.length}{e.capacity !== null ? ` / ${e.capacity}` : ""} คน</p>
        </div>
        {e.isPublished ? <Link href={`/events/${e.id}`} className="btn btn-outline">ดูหน้ากิจกรรม</Link> : null}
      </div>
      {saved ? <p className="flash flash-ok" role="status">บันทึกกิจกรรมแล้ว</p> : null}

      <EventForm e={e} />

      <section className="admin-card" id="registrants" aria-labelledby="reg-h">
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <h2 id="reg-h" style={{ margin: 0 }}>ผู้ลงทะเบียน ({active.length})</h2>
          <a href={`/admin/events/${e.id}/export`} className="btn btn-outline btn-sm">⬇ ส่งออก CSV</a>
        </div>
        {registrants.length === 0 ? (
          <p className="muted">ยังไม่มีผู้ลงทะเบียน</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">ชื่อ</th><th scope="col">รุ่น / สาขา</th><th scope="col">อีเมล</th><th scope="col">ลงทะเบียนเมื่อ</th></tr></thead>
              <tbody>
                {registrants.map((r, i) => (
                  <tr key={i} className={r.cancelled_at ? "muted" : undefined}>
                    <td>{r.name}{r.cancelled_at ? <span className="small"> (ยกเลิกแล้ว)</span> : null}</td>
                    <td className="small">{r.cohort} · {r.program}</td>
                    <td className="small">{r.email ?? "—"}</td>
                    <td className="small">{thaiDateTime(r.registered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card" id="items" aria-labelledby="items-h">
        <h2 id="items-h">ของที่ระลึก</h2>
        {items.length ? (
          <ul className="list-plain">
            {items.map((it) => (
              <li key={it.id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                <span>
                  <strong>{it.name}</strong> · {it.priceBaht} บาท · จองแล้ว {it.reserved}{it.stock !== null ? ` / ${it.stock}` : ""}
                  {it.options.length ? <span className="small muted"> · ตัวเลือก {it.options.join(", ")}</span> : null}
                  {!it.isActive ? <span className="pill pill-draft" style={{ marginLeft: 6 }}>ปิดรับจอง</span> : null}
                </span>
                <form action={toggleItemAction}>
                  <input type="hidden" name="itemId" value={it.id} />
                  <button type="submit" className="btn btn-outline btn-sm">{it.isActive ? "ปิดรับจอง" : "เปิดรับจอง"}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className="muted">ยังไม่มีของที่ระลึก</p>}
        <ActionForm action={addItemAction} submitLabel="+ เพิ่มของที่ระลึก" className="" submitClassName="btn btn-outline btn-sm" resetOnSuccess>
          <input type="hidden" name="eventId" value={e.id} />
          <div className="field-grid">
            <Field name="itemName" label="ชื่อสินค้า" maxLength={120} />
            <Field name="price" type="number" label="ราคา (บาท)" min={0} defaultValue={0} />
            <Field name="stock" type="number" label="จำนวน (เว้นว่างถ้าไม่จำกัด)" min={0} />
            <Field name="options" label="ตัวเลือก คั่นด้วยจุลภาค เช่น S, M, L, XL" />
          </div>
        </ActionForm>
      </section>

      {orders.length ? (
        <section className="admin-card" id="orders" aria-labelledby="orders-h">
          <h2 id="orders-h">รายการจอง</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">ผู้จอง</th><th scope="col">สินค้า</th><th scope="col" className="num">จำนวน</th><th scope="col">สถานะ</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}<div className="small muted">{thaiDateTime(o.created_at)}</div></td>
                    <td>{o.item}{o.option ? ` (${o.option})` : ""}</td>
                    <td className="num">{o.quantity}</td>
                    <td>
                      <form action={setOrderStatusAction} className="inline-actions">
                        <input type="hidden" name="orderId" value={o.id} />
                        <label className="sr-only" htmlFor={`os${o.id}`}>สถานะ</label>
                        <select id={`os${o.id}`} name="status" defaultValue={o.status}>
                          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button type="submit" className="btn btn-outline btn-sm">บันทึก</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <form action={deleteEventAction} className="admin-card danger-zone">
        <input type="hidden" name="recordId" value={e.id} />
        <h2>ลบกิจกรรม</h2>
        <p className="small muted">การลงทะเบียนและรายการจองของกิจกรรมนี้จะถูกลบไปด้วย</p>
        <ConfirmButton message="ลบกิจกรรมนี้และข้อมูลการลงทะเบียนทั้งหมด?" className="btn btn-danger btn-sm">ลบกิจกรรม</ConfirmButton>
      </form>
    </>
  );
}
