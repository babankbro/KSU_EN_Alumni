import Link from "next/link";
import { bkkParts, registrationState, type EventData } from "@/lib/server/events";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** FR-EVT-02/03 — one event in a list, with its registration state. */
export default function EventRow({ e }: { e: EventData }) {
  const s = bkkParts(e.startsAt);
  const end = e.endsAt ? bkkParts(e.endsAt) : null;
  const reg = registrationState(e);
  return (
    <div className="event">
      {e.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="event-image" src={e.coverUrl} alt="" loading="lazy" />
      ) : null}
      <div className="event-date" aria-hidden="true">
        <div className="d">{String(s.d).padStart(2, "0")}</div>
        <div className="m">{MONTHS[s.m - 1]}</div>
        <div className="y">{s.y + 543}</div>
      </div>
      <div>
        <h3><Link href={`/events/${e.id}`}>{e.title}</Link></h3>
        <p className="where">
          {e.isOnline ? "💻" : "📍"} {e.venue ?? "รอประกาศสถานที่"} · {s.hh}:{s.mm}
          {end ? `–${end.hh}:${end.mm}` : ""} น.
        </p>
        <p style={{ margin: "8px 0 0" }}>
          {reg.open ? (
            <Link href={`/events/${e.id}`}>
              ลงทะเบียนเข้าร่วม →{e.capacity !== null ? <span className="small muted"> (เหลือ {e.capacity - e.registered} ที่)</span> : null}
            </Link>
          ) : (
            <span className="tag tag-outline">{reg.reason}</span>
          )}
        </p>
      </div>
    </div>
  );
}
