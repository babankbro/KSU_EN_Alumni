import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import { getCohortRoll } from "@/lib/server/directory";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "ทำเนียบรุ่น" };

/** FR-DIR-04 — the cohort roll: how many alumni per admission year and programme. */
export default async function CohortsPage() {
  const roll = await getCohortRoll();
  const total = roll.reduce((a, r) => a + r.total, 0);

  return (
    <>
      <PageHead crumb="ทำเนียบรุ่น" title="ทำเนียบรุ่น" lead={`ศิษย์เก่าที่แสดงในทำเนียบ ${formatNumber(total)} คน จาก ${roll.length} รุ่น`} />
      <section className="section">
        <div className="wrap">
          <p className="small"><Link href="/directory">← ค้นหาในทำเนียบ</Link></p>
          {roll.length === 0 ? (
            <div className="empty-state"><p>ยังไม่มีศิษย์เก่าในทำเนียบ</p></div>
          ) : (
            <div className="grid grid-3">
              {roll.map((r) => (
                <article className="card" key={r.year}>
                  <div className="card-body">
                    <h3><Link href={`/directory?cohort=${r.year}`}>รุ่น {r.year}</Link></h3>
                    <p style={{ margin: "0 0 8px" }}><strong>{formatNumber(r.total)}</strong> คน</p>
                    <ul className="small" style={{ display: "grid", gap: 4 }}>
                      {r.programs.map((p) => (
                        <li key={p.name}>{p.level} {p.name} — {p.n}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
