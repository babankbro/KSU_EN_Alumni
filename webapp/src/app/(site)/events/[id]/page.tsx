import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/PageHead";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { query } from "@/lib/server/db";
import { getEvent, listEventItems, registrationState } from "@/lib/server/events";
import { formatThaiDateTime } from "@/lib/server/format-server";
import { getViewer } from "@/lib/server/member-auth";
import { cancelOrderAction, cancelRegistrationAction, orderItemAction, registerEventAction } from "../actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> };

const RESULT: Record<string, [string, "ok" | "warn"]> = {
  ok: ["ลงทะเบียนเรียบร้อย ระบบจะแจ้งเตือนก่อนวันงาน", "ok"],
  cancelled: ["ยกเลิกการลงทะเบียนแล้ว", "ok"],
  full: ["ขออภัย ที่นั่งเต็มแล้ว", "warn"],
  closed: ["กิจกรรมนี้ปิดรับลงทะเบียนแล้ว", "warn"],
  error: ["ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "warn"],
  order_cancelled: ["ยกเลิกการจองแล้ว", "ok"],
};
const ORDER_STATUS: Record<string, string> = { reserved: "จองแล้ว รอชำระ", paid: "ชำระแล้ว", delivered: "รับของแล้ว", cancelled: "ยกเลิก" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const e = Number.isInteger(id) ? await getEvent(id) : null;
  return { title: e?.title ?? "กิจกรรม" };
}

export default async function EventPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const e = await getEvent(id);
  if (!e) notFound();
  const { r } = await searchParams;
  const result = r ? RESULT[r] : undefined;

  const viewer = await getViewer();
  const alumniId = viewer.kind === "alumni" && viewer.verified ? viewer.account.alumniId : null;
  const reg = registrationState(e);
  const [mine] = alumniId
    ? await query<{ registered_at: Date }>(
        `SELECT registered_at FROM event_registration WHERE event_id = $1 AND alumni_id = $2 AND cancelled_at IS NULL`,
        [id, alumniId],
      )
    : [];
  const items = await listEventItems(id);
  const orders = alumniId
    ? await query<{ id: number; name: string; quantity: number; option: string | null; status: string; price_baht: number }>(
        `SELECT o.id, i.name, o.quantity, o.option, o.status, i.price_baht FROM event_order o JOIN event_item i ON i.id = o.item_id
         WHERE i.event_id = $1 AND o.alumni_id = $2 ORDER BY o.created_at DESC`,
        [id, alumniId],
      )
    : [];

  return (
    <>
      <PageHead crumb="กิจกรรม" title={e.title} lead={`${formatThaiDateTime(e.startsAt)}${e.venue ? ` · ${e.venue}` : ""}`} />
      <section className="section">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <p className="small"><Link href="/events">← ปฏิทินกิจกรรม</Link></p>
          {result ? <p className={`flash flash-${result[1]}`} role="status">{result[0]}</p> : null}

          {e.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.coverUrl} alt="" className="post-image" />
          ) : null}

          <div className="admin-grid-2">
            <section className="admin-card">
              <h2>รายละเอียด</h2>
              <dl className="kv">
                <dt>เริ่ม</dt><dd>{formatThaiDateTime(e.startsAt)}</dd>
                {e.endsAt ? (<><dt>สิ้นสุด</dt><dd>{formatThaiDateTime(e.endsAt)}</dd></>) : null}
                <dt>สถานที่</dt><dd>{e.isOnline ? "ออนไลน์ — " : ""}{e.venue ?? "รอประกาศ"}</dd>
                {e.capacity !== null ? (<><dt>จำนวนที่รับ</dt><dd>{e.registered} / {e.capacity} คน</dd></>) : null}
                {e.registrationClosesAt ? (<><dt>ปิดรับลงทะเบียน</dt><dd>{formatThaiDateTime(e.registrationClosesAt)}</dd></>) : null}
              </dl>
            </section>

            <section className="admin-card" aria-labelledby="reg-h">
              <h2 id="reg-h">ลงทะเบียน</h2>
              {mine ? (
                <>
                  <p>✓ คุณลงทะเบียนแล้วเมื่อ {formatThaiDateTime(mine.registered_at)}</p>
                  {e.startsAt > new Date() ? (
                    <form action={cancelRegistrationAction}>
                      <input type="hidden" name="eventId" value={e.id} />
                      <button type="submit" className="btn btn-outline btn-sm">ยกเลิกการลงทะเบียน</button>
                    </form>
                  ) : null}
                </>
              ) : !reg.open ? (
                <p className="muted">{reg.reason}</p>
              ) : alumniId ? (
                <form action={registerEventAction}>
                  <input type="hidden" name="eventId" value={e.id} />
                  <button type="submit" className="btn btn-primary">ลงทะเบียนเข้าร่วม</button>
                </form>
              ) : viewer.kind === "anonymous" ? (
                <p><Link className="btn btn-primary" href={`/login?next=/events/${e.id}`}>เข้าสู่ระบบเพื่อลงทะเบียน</Link></p>
              ) : (
                <p className="small muted">การลงทะเบียนเปิดให้ศิษย์เก่าที่ยืนยันตัวตนแล้ว</p>
              )}
            </section>
          </div>

          {e.description ? (
            <section className="admin-card">
              <h2>เกี่ยวกับกิจกรรม</h2>
              <p className="post-text">{e.description}</p>
            </section>
          ) : null}

          {items.length ? (
            <section className="admin-card" aria-labelledby="items-h">
              <h2 id="items-h">ของที่ระลึก</h2>
              <div className="item-grid">
                {items.map((it) => {
                  const left = it.stock === null ? null : Math.max(0, it.stock - it.reserved);
                  return (
                    <div key={it.id} className="item-card">
                      <h3>{it.name}</h3>
                      <p className="small">{it.priceBaht.toLocaleString("th-TH")} บาท{left !== null ? ` · เหลือ ${left} ชิ้น` : ""}</p>
                      {alumniId && left !== 0 ? (
                        <ActionForm action={orderItemAction} submitLabel="จอง" pendingLabel="กำลังจอง…" className="" submitClassName="btn btn-outline btn-sm">
                          <input type="hidden" name="itemId" value={it.id} />
                          {it.options.length ? <Field as="select" name="option" label="ตัวเลือก" options={it.options} emptyLabel="— เลือก —" /> : null}
                          <Field name="quantity" type="number" label="จำนวน" defaultValue={1} min={1} max={20} />
                        </ActionForm>
                      ) : left === 0 ? (
                        <p className="small muted">หมดแล้ว</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {!alumniId ? <p className="small muted">ศิษย์เก่าที่ยืนยันตัวตนแล้วจองของที่ระลึกได้ ชำระเงินและรับของตามที่คณะแจ้ง</p> : null}
              {orders.length ? (
                <>
                  <h3 style={{ marginTop: 16 }}>รายการจองของฉัน</h3>
                  <ul className="list-plain">
                    {orders.map((o) => (
                      <li key={o.id} className="inline-actions" style={{ justifyContent: "space-between" }}>
                        <span>
                          {o.name}{o.option ? ` (${o.option})` : ""} × {o.quantity} — {(o.price_baht * o.quantity).toLocaleString("th-TH")} บาท ·{" "}
                          <span className="small muted">{ORDER_STATUS[o.status]}</span>
                        </span>
                        {o.status === "reserved" ? (
                          <form action={cancelOrderAction}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <button type="submit" className="link-danger">ยกเลิก</button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </>
  );
}
