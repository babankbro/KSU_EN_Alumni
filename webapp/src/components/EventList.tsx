import type { AlumniEvent } from "@/lib/types";
import Image from "next/image";
import { formatTime, parseBe } from "@/lib/format";

const MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** FR-EVT-02/03 — upcoming events with a registration entry point. */
export default function EventList({ events }: { events: AlumniEvent[] }) {
  return (
    <>
      {events.map((e) => {
        const { year, month, day } = parseBe(e.startsAt);
        return (
          <div className="event" key={e.id}>
            {e.imageSrc ? (
              <Image
                className="event-image"
                src={e.imageSrc}
                alt=""
                width={640}
                height={400}
                sizes="(max-width: 860px) 100vw, 240px"
              />
            ) : null}
            <div className="event-date" aria-hidden="true">
              <div className="d">{String(day).padStart(2, "0")}</div>
              <div className="m">{MONTHS[month - 1]}</div>
              <div className="y">{year}</div>
            </div>
            <div>
              <h3>{e.title}</h3>
              <p className="where">
                {e.isOnline ? "💻" : "📍"} {e.venue} · {formatTime(e.startsAt)}–
                {formatTime(e.endsAt)} น.
              </p>
              <p style={{ margin: "8px 0 0" }}>
                {e.registrationOpen ? (
                  <a href="#">ลงทะเบียนเข้าร่วม →</a>
                ) : (
                  <span className="tag tag-outline">ยังไม่เปิดลงทะเบียน</span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </>
  );
}
