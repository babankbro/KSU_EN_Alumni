"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { storeUpload, UploadError } from "@/lib/server/files";
import { fromLocalInput } from "@/lib/server/events";
import type { FormState } from "@/lib/form-state";

/** Back-office events (FR-EVT-01/04/06): admins and content editors. */

const EDITORS = ["admin", "editor"] as const;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

export async function saveEventAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin([...EDITORS]);
  const id = fd.get("recordId") ? Number(fd.get("recordId")) : null;
  const title = str(fd, "title");
  const description = str(fd, "description");
  const venue = str(fd, "venue");
  const startsAt = fromLocalInput(str(fd, "startsAt"));
  const endsAt = str(fd, "endsAt") ? fromLocalInput(str(fd, "endsAt")) : null;
  const closesAt = str(fd, "registrationClosesAt") ? fromLocalInput(str(fd, "registrationClosesAt")) : null;
  const capacityRaw = str(fd, "capacity");
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  const fe: Record<string, string> = {};
  if (title.length < 3 || title.length > 200) fe.title = "ชื่อกิจกรรมต้องยาว 3–200 ตัวอักษร";
  if (!startsAt) fe.startsAt = "กรุณาระบุวันเวลาเริ่ม";
  if (str(fd, "endsAt") && !endsAt) fe.endsAt = "รูปแบบวันเวลาไม่ถูกต้อง";
  if (startsAt && endsAt && endsAt < startsAt) fe.endsAt = "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม";
  if (str(fd, "registrationClosesAt") && !closesAt) fe.registrationClosesAt = "รูปแบบวันเวลาไม่ถูกต้อง";
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) fe.capacity = "จำนวนที่รับต้องเป็นจำนวนเต็มบวก";
  if (description.length > 10000) fe.description = "รายละเอียดยาวเกินไป";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  let coverId: string | null | undefined;
  const cover = fd.get("cover");
  if (cover instanceof File && cover.size > 0) {
    try {
      coverId = (await storeUpload(cover, "event_cover", { uploadedBy: session.id })).id;
    } catch (err) {
      if (err instanceof UploadError) return { fieldErrors: { cover: err.message } };
      throw err;
    }
  }

  const params = [
    title, description || null, startsAt, endsAt, venue || null, fd.get("isOnline") === "on",
    fd.get("registrationOpen") === "on", capacity, closesAt, fd.get("isPublished") === "on",
  ];
  let eventId: number;
  if (id) {
    const [row] = await query<{ id: number }>(
      `UPDATE event SET title = $1, description = $2, starts_at = $3, ends_at = $4, venue = $5, is_online = $6,
              registration_open = $7, capacity = $8, registration_closes_at = $9, is_published = $10,
              cover_file_id = CASE WHEN $12::boolean THEN NULL ELSE coalesce($11, cover_file_id) END
       WHERE id = $13 RETURNING id`,
      [...params, coverId ?? null, fd.get("removeCover") === "on", id],
    );
    if (!row) return { error: "ไม่พบกิจกรรมนี้" };
    eventId = row.id;
  } else {
    const [row] = await query<{ id: number }>(
      `INSERT INTO event (title, description, starts_at, ends_at, venue, is_online, registration_open, capacity,
                          registration_closes_at, is_published, cover_file_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [...params, coverId ?? null, session.id],
    );
    eventId = row.id;
  }
  await audit(session, id ? "event.update" : "event.create", "event", eventId, { title });
  revalidatePath("/events");
  redirect(`/admin/events/${eventId}?saved=1`);
}

export async function deleteEventAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...EDITORS]);
  const id = Number(fd.get("recordId"));
  const [row] = await query<{ title: string }>(`DELETE FROM event WHERE id = $1 RETURNING title`, [id]);
  if (row) await audit(session, "event.delete", "event", id, { title: row.title });
  revalidatePath("/events");
  redirect("/admin/events?deleted=1");
}

/* ---------------- souvenirs (FR-EVT-06) ---------------- */

export async function addItemAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin([...EDITORS]);
  const eventId = Number(fd.get("eventId"));
  const name = str(fd, "itemName");
  const price = Number(str(fd, "price") || "0");
  const stockRaw = str(fd, "stock");
  const stock = stockRaw ? Number(stockRaw) : null;
  const options = str(fd, "options").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);

  const fe: Record<string, string> = {};
  if (!name || name.length > 120) fe.itemName = "กรุณาระบุชื่อสินค้า";
  if (!Number.isInteger(price) || price < 0) fe.price = "ราคาเป็นจำนวนเต็มบาท";
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) fe.stock = "จำนวนเป็นจำนวนเต็ม หรือเว้นว่างถ้าไม่จำกัด";
  if (Object.keys(fe).length) return { fieldErrors: fe };

  await query(
    `INSERT INTO event_item (event_id, name, price_baht, stock, options) VALUES ($1, $2, $3, $4, $5)`,
    [eventId, name, price, stock, options],
  );
  await audit(session, "event.item_add", "event", eventId, { name });
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: `เพิ่ม “${name}” แล้ว` };
}

export async function toggleItemAction(fd: FormData): Promise<void> {
  await requireAdmin([...EDITORS]);
  const id = Number(fd.get("itemId"));
  const [row] = await query<{ event_id: number }>(
    `UPDATE event_item SET is_active = NOT is_active WHERE id = $1 RETURNING event_id`,
    [id],
  );
  redirect(row ? `/admin/events/${row.event_id}#items` : "/admin/events");
}

export async function setOrderStatusAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...EDITORS]);
  const id = Number(fd.get("orderId"));
  const status = str(fd, "status");
  if (!["reserved", "paid", "delivered", "cancelled"].includes(status)) redirect("/admin/events");
  const [row] = await query<{ event_id: number }>(
    `UPDATE event_order o SET status = $2 FROM event_item i WHERE o.id = $1 AND i.id = o.item_id RETURNING i.event_id`,
    [id, status],
  );
  if (row) await audit(session, "event.order_status", "event_order", id, { status });
  redirect(row ? `/admin/events/${row.event_id}#orders` : "/admin/events");
}
