"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool, query } from "@/lib/server/db";
import { requireMember } from "@/lib/server/member-auth";
import type { FormState } from "@/lib/form-state";

/**
 * Event registration and souvenir orders (FR-EVT-03, FR-EVT-06) for verified
 * alumni. Capacity and stock are checked with the event / item row locked, so
 * two people taking the last seat at the same moment cannot both get it.
 */

async function alumni() {
  const acc = await requireMember({ alumni: true, verified: true });
  if (!acc.alumniId) redirect("/me?need=alumni");
  return { acc, alumniId: acc.alumniId };
}

export async function registerEventAction(fd: FormData): Promise<void> {
  const { alumniId } = await alumni();
  const id = Number(fd.get("eventId"));
  if (!Number.isInteger(id)) redirect("/events");

  const client = await getPool().connect();
  let result = "ok";
  try {
    await client.query("BEGIN");
    const { rows: [e] } = await client.query<{ open: boolean; starts_at: Date; closes: Date | null; capacity: number | null }>(
      `SELECT registration_open AND is_published AS open, starts_at, registration_closes_at AS closes, capacity
       FROM event WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const { rows: [{ n }] } = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM event_registration WHERE event_id = $1 AND cancelled_at IS NULL AND alumni_id <> $2`,
      [id, alumniId],
    );
    if (!e || !e.open || e.starts_at <= new Date() || (e.closes && e.closes <= new Date())) result = "closed";
    else if (e.capacity !== null && Number(n) >= e.capacity) result = "full";
    else {
      await client.query(
        `INSERT INTO event_registration (event_id, alumni_id) VALUES ($1, $2)
         ON CONFLICT (event_id, alumni_id) DO UPDATE
           SET cancelled_at = NULL, reminded_at = NULL,
               registered_at = CASE WHEN event_registration.cancelled_at IS NULL THEN event_registration.registered_at ELSE now() END`,
        [id, alumniId],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[events] register", err);
    result = "error";
  } finally {
    client.release();
  }
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}?r=${result}`);
}

export async function cancelRegistrationAction(fd: FormData): Promise<void> {
  const { alumniId } = await alumni();
  const id = Number(fd.get("eventId"));
  await query(
    `UPDATE event_registration SET cancelled_at = now() WHERE event_id = $1 AND alumni_id = $2 AND cancelled_at IS NULL`,
    [id, alumniId],
  );
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}?r=cancelled`);
}

export async function orderItemAction(_p: FormState, fd: FormData): Promise<FormState> {
  const { alumniId } = await alumni();
  const itemId = Number(fd.get("itemId"));
  const quantity = Number(fd.get("quantity"));
  const option = typeof fd.get("option") === "string" ? (fd.get("option") as string) : "";
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { fieldErrors: { quantity: "จำนวน 1–20 ชิ้น" } };

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows: [item] } = await client.query<{ event_id: number; stock: number | null; options: string[]; name: string }>(
      `SELECT i.event_id, i.stock, i.options, i.name FROM event_item i JOIN event e ON e.id = i.event_id
       WHERE i.id = $1 AND i.is_active AND e.is_published FOR UPDATE OF i`,
      [itemId],
    );
    if (!item) {
      await client.query("ROLLBACK");
      return { error: "ไม่พบสินค้านี้ หรือปิดรับจองแล้ว" };
    }
    if (item.options.length && !item.options.includes(option)) {
      await client.query("ROLLBACK");
      return { fieldErrors: { option: "กรุณาเลือกตัวเลือก" } };
    }
    if (item.stock !== null) {
      const { rows: [{ used }] } = await client.query<{ used: string }>(
        `SELECT coalesce(sum(quantity), 0) AS used FROM event_order WHERE item_id = $1 AND status <> 'cancelled'`,
        [itemId],
      );
      if (Number(used) + quantity > item.stock) {
        await client.query("ROLLBACK");
        const left = Math.max(0, item.stock - Number(used));
        return { error: left ? `เหลือเพียง ${left} ชิ้น` : "สินค้าหมดแล้ว" };
      }
    }
    await client.query(
      `INSERT INTO event_order (item_id, alumni_id, quantity, option) VALUES ($1, $2, $3, NULLIF($4, ''))`,
      [itemId, alumniId, quantity, option],
    );
    await client.query("COMMIT");
    revalidatePath(`/events/${item.event_id}`);
    return { ok: `จอง ${item.name}${option ? ` (${option})` : ""} จำนวน ${quantity} ชิ้นแล้ว — ชำระเงินและรับของตามที่คณะแจ้ง` };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[events] order", err);
    return { error: "จองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  } finally {
    client.release();
  }
}

export async function cancelOrderAction(fd: FormData): Promise<void> {
  const { alumniId } = await alumni();
  const id = Number(fd.get("orderId"));
  const [row] = await query<{ event_id: number }>(
    `UPDATE event_order o SET status = 'cancelled' FROM event_item i
     WHERE o.id = $1 AND o.alumni_id = $2 AND o.status = 'reserved' AND i.id = o.item_id
     RETURNING i.event_id`,
    [id, alumniId],
  );
  if (row) revalidatePath(`/events/${row.event_id}`);
  redirect(row ? `/events/${row.event_id}?r=order_cancelled` : "/me/activity");
}
