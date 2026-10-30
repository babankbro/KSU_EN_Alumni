import "server-only";
import { query } from "./db";
import { fileUrl } from "./files";

/** Events, registration and souvenirs (FR-EVT-01 … 06). */

export interface EventData {
  id: number;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  venue: string | null;
  isOnline: boolean;
  registrationOpen: boolean;
  registrationClosesAt: Date | null;
  capacity: number | null;
  registered: number;
  coverUrl: string | null;
  isPublished: boolean;
}

interface Row {
  id: number; title: string; description: string | null; starts_at: Date; ends_at: Date | null; venue: string | null;
  is_online: boolean; registration_open: boolean; registration_closes_at: Date | null; capacity: number | null;
  registered: string; cover_file_id: string | null; is_published: boolean;
}

const SELECT = `
  SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.venue, e.is_online, e.registration_open,
         e.registration_closes_at, e.capacity, e.cover_file_id, e.is_published,
         (SELECT count(*) FROM event_registration r WHERE r.event_id = e.id AND r.cancelled_at IS NULL) AS registered
  FROM event e`;

function toEvent(r: Row): EventData {
  return {
    id: r.id, title: r.title, description: r.description, startsAt: r.starts_at, endsAt: r.ends_at, venue: r.venue,
    isOnline: r.is_online, registrationOpen: r.registration_open, registrationClosesAt: r.registration_closes_at,
    capacity: r.capacity, registered: Number(r.registered), coverUrl: r.cover_file_id ? fileUrl(r.cover_file_id) : null,
    isPublished: r.is_published,
  };
}

/** Can someone register right now? Returns the reason when not. */
export function registrationState(e: EventData): { open: true } | { open: false; reason: string } {
  const now = Date.now();
  if (!e.registrationOpen) return { open: false, reason: "ยังไม่เปิดลงทะเบียน" };
  if (e.startsAt.getTime() <= now) return { open: false, reason: "กิจกรรมเริ่มไปแล้ว" };
  if (e.registrationClosesAt && e.registrationClosesAt.getTime() <= now) return { open: false, reason: "ปิดรับลงทะเบียนแล้ว" };
  if (e.capacity !== null && e.registered >= e.capacity) return { open: false, reason: "ที่นั่งเต็มแล้ว" };
  return { open: true };
}

export async function listUpcomingEvents(limit = 50): Promise<EventData[]> {
  const rows = await query<Row>(
    `${SELECT} WHERE e.is_published AND coalesce(e.ends_at, e.starts_at) >= now() ORDER BY e.starts_at LIMIT $1`,
    [limit],
  );
  return rows.map(toEvent);
}

export async function listPastEvents(limit = 12): Promise<EventData[]> {
  const rows = await query<Row>(
    `${SELECT} WHERE e.is_published AND coalesce(e.ends_at, e.starts_at) < now() ORDER BY e.starts_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toEvent);
}

/** Events in one calendar month (Bangkok time), for the month grid. */
export async function listEventsInMonth(year: number, month: number): Promise<EventData[]> {
  const rows = await query<Row>(
    `${SELECT} WHERE e.is_published
       AND (e.starts_at AT TIME ZONE 'Asia/Bangkok') >= make_date($1, $2, 1)
       AND (e.starts_at AT TIME ZONE 'Asia/Bangkok') < make_date($1, $2, 1) + interval '1 month'
     ORDER BY e.starts_at`,
    [year, month],
  );
  return rows.map(toEvent);
}

export async function getEvent(id: number, opts: { includeDrafts?: boolean } = {}): Promise<EventData | null> {
  const [r] = await query<Row>(`${SELECT} WHERE e.id = $1 ${opts.includeDrafts ? "" : "AND e.is_published"}`, [id]);
  return r ? toEvent(r) : null;
}

export interface EventItem {
  id: number;
  name: string;
  priceBaht: number;
  stock: number | null;
  reserved: number;
  options: string[];
  isActive: boolean;
}

export async function listEventItems(eventId: number, activeOnly = true): Promise<EventItem[]> {
  const rows = await query<{ id: number; name: string; price_baht: number; stock: number | null; options: string[]; is_active: boolean; reserved: string }>(
    `SELECT i.id, i.name, i.price_baht, i.stock, i.options, i.is_active,
            coalesce((SELECT sum(o.quantity) FROM event_order o WHERE o.item_id = i.id AND o.status <> 'cancelled'), 0) AS reserved
     FROM event_item i WHERE i.event_id = $1 ${activeOnly ? "AND i.is_active" : ""} ORDER BY i.id`,
    [eventId],
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, priceBaht: r.price_baht, stock: r.stock, reserved: Number(r.reserved), options: r.options, isActive: r.is_active,
  }));
}

const BKK = "Asia/Bangkok";
export function bkkParts(d: Date): { y: number; m: number; d: number; hh: string; mm: string } {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: BKK, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour, mm: p.minute };
}

/** "2026-11-14T17:00" in Bangkok time, for <input type="datetime-local">. */
export function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const p = bkkParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T${p.hh}:${p.mm}`;
}

/** Parses a datetime-local value as Bangkok time. */
export function fromLocalInput(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
