import { getSiteFigures } from "@/lib/server/directory";
import StatCounter from "./StatCounter";

/**
 * Visual Design §5.4 + FR-DIR-05 — headline figures from the database.
 * §5.4 forbids showing example numbers as if they were real, so when the
 * database cannot be reached the strip shows dashes instead of guessing.
 */
export default async function StatsStrip() {
  const f = await getSiteFigures();

  const figures = f
    ? [
        { value: f.alumni, label: "ศิษย์เก่าที่ยืนยันตัวตนแล้ว" },
        { value: f.cohorts, label: "จำนวนรุ่น" },
        { value: f.programs, label: "หลักสูตรที่เปิดสอน" },
        { value: f.freshPct, label: "% ข้อมูลเป็นปัจจุบัน (12 เดือน)" },
      ]
    : null;

  return (
    <section className="stats" aria-label="สถิติภาพรวม">
      <div className="wrap">
        {figures
          ? figures.map((x) => (
              <div className="stat" key={x.label}>
                <StatCounter value={x.value} label={x.label} />
              </div>
            ))
          : ["ศิษย์เก่าที่ยืนยันตัวตนแล้ว", "จำนวนรุ่น", "หลักสูตรที่เปิดสอน", "% ข้อมูลเป็นปัจจุบัน"].map((l) => (
              <div className="stat" key={l}>
                <div className="stat-num">—</div>
                <div className="stat-label">{l}</div>
              </div>
            ))}
      </div>
    </section>
  );
}
