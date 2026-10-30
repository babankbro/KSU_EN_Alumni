import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import EventRow from "@/components/EventRow";
import { bkkParts, listEventsInMonth, listPastEvents, listUpcomingEvents } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "กิจกรรม",
  description: "ปฏิทินกิจกรรมศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์",
};

const MONTH_NAMES = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = bkkParts(new Date());
  const [y, mo] = /^\d{4}-\d{2}$/.test(m ?? "") ? m!.split("-").map(Number) : [today.y, today.m];
  const year = mo >= 1 && mo <= 12 ? y : today.y;
  const month = mo >= 1 && mo <= 12 ? mo : today.m;

  const [upcoming, past, inMonth] = await Promise.all([listUpcomingEvents(), listPastEvents(), listEventsInMonth(year, month)]);

  // FR-EVT-02 month grid (Sunday first, as Thai wall calendars are)
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const byDay = new Map<number, typeof inMonth>();
  for (const e of inMonth) {
    const d = bkkParts(e.startsAt).d;
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const prev = month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
  const next = month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);
  const isThisMonth = year === today.y && month === today.m;

  return (
    <>
      <PageHead crumb="กิจกรรม" title="ปฏิทินกิจกรรม" lead="งานคืนสู่เหย้า กิจกรรมแนะแนวอาชีพ และงานของแต่ละรุ่น" />
      <section className="section">
        <div className="wrap events-layout">
          <div>
            <h2 className="section-title-sm">กิจกรรมที่กำลังจะมาถึง</h2>
            <div className="card">
              {upcoming.length ? upcoming.map((e) => <EventRow key={e.id} e={e} />) : <p className="muted" style={{ padding: 20 }}>ยังไม่มีกิจกรรมที่กำหนดไว้</p>}
            </div>

            {past.length ? (
              <>
                <h2 className="section-title-sm" style={{ marginTop: 32 }}>กิจกรรมที่ผ่านมา</h2>
                <ul className="list-plain">
                  {past.map((e) => (
                    <li key={e.id}>
                      <Link href={`/events/${e.id}`}>{e.title}</Link>{" "}
                      <span className="small muted">· {bkkParts(e.startsAt).d}/{bkkParts(e.startsAt).m}/{bkkParts(e.startsAt).y + 543}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <aside className="card cal" aria-labelledby="cal-h">
            <div className="cal-head">
              <Link href={`/events?m=${prev}`} aria-label="เดือนก่อนหน้า">‹</Link>
              <h2 id="cal-h">{MONTH_NAMES[month - 1]} {year + 543}</h2>
              <Link href={`/events?m=${next}`} aria-label="เดือนถัดไป">›</Link>
            </div>
            <table className="cal-grid">
              <thead>
                <tr>{WEEKDAYS.map((w) => <th key={w} scope="col">{w}</th>)}</tr>
              </thead>
              <tbody>
                {Array.from({ length: cells.length / 7 }, (_, r) => (
                  <tr key={r}>
                    {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                      const evs = d ? byDay.get(d) : undefined;
                      const today_ = isThisMonth && d === today.d;
                      return (
                        <td key={i} className={`${evs ? "has-event" : ""}${today_ ? " is-today" : ""}`}>
                          {d ? (
                            evs ? (
                              <Link href={`/events/${evs[0].id}`} title={evs.map((e) => e.title).join(" · ")}>
                                {d}<span className="sr-only"> — {evs.map((e) => e.title).join(", ")}</span>
                              </Link>
                            ) : (
                              <span>{d}</span>
                            )
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {inMonth.length ? (
              <ul className="cal-list">
                {inMonth.map((e) => (
                  <li key={e.id}>
                    <strong>{bkkParts(e.startsAt).d}</strong> <Link href={`/events/${e.id}`}>{e.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">ไม่มีกิจกรรมในเดือนนี้</p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
