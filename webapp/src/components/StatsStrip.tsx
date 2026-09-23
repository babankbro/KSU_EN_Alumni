import { ALUMNI, PROGRAMS } from "@/lib/data";
import { isStale } from "@/lib/format";
import StatCounter from "./StatCounter";

/**
 * Visual Design §5.4 — Alumni statistics.
 *
 * Every figure is derived from the sample dataset rather than hard-coded, and
 * the strip says so: §5.4 explicitly forbids presenting example numbers as if
 * they were live database values.
 */
export default function StatsStrip() {
  const claimed = ALUMNI.filter((a) => a.claimStatus === "verified");
  const cohorts = new Set(claimed.map((a) => a.admissionYear)).size;
  const freshProfiles = claimed.filter((a) => !isStale(a.profileUpdatedAt)).length;

  const figures = [
    { value: claimed.length, label: "ศิษย์เก่าในระบบ" },
    { value: cohorts, label: "จำนวนรุ่น" },
    { value: PROGRAMS.length, label: "สาขาวิชา" },
    { value: freshProfiles, label: "โปรไฟล์ที่อัปเดตใน 12 เดือน" },
  ];

  return (
    <section className="stats" aria-label="สถิติภาพรวม">
      <div className="wrap">
        {figures.map((f) => (
          <div className="stat" key={f.label}>
            <StatCounter value={f.value} label={f.label} />
          </div>
        ))}
        <p className="stats-disclaimer">
          ตัวเลขข้างต้นคำนวณจาก<strong>ข้อมูลตัวอย่าง</strong>ในเว็บไซต์ร่างนี้
          ระบบจริงจะดึงจากฐานข้อมูลศิษย์เก่าโดยตรง
        </p>
      </div>
    </section>
  );
}
