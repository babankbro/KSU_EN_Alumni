import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import DirectoryCard from "@/components/DirectoryCard";
import { DIR_PAGE_SIZE, getFacets, parseDirFilter, searchDirectory, type DirFilter, type FacetOption } from "@/lib/server/directory";
import { getViewer, isMember, viewerAccount } from "@/lib/server/member-auth";
import { hit, LIMITS } from "@/lib/server/rate-limit";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "ทำเนียบศิษย์เก่า",
  description: "ค้นหาศิษย์เก่าคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม ม.กาฬสินธุ์ ตามรุ่น สาขา จังหวัด กลุ่มอาชีพ และทักษะ",
};

type SP = Record<string, string | string[] | undefined>;

const FACETS: { key: keyof Omit<DirFilter, "q" | "page">; label: string }[] = [
  { key: "cohort", label: "รุ่น (ปีที่เข้าศึกษา)" },
  { key: "level", label: "ระดับการศึกษา" },
  { key: "program", label: "สาขาวิชา" },
  { key: "province", label: "จังหวัด" },
  { key: "category", label: "กลุ่มอาชีพ" },
  { key: "skill", label: "ทักษะวิชาชีพ" },
];

function toQuery(f: DirFilter, patch: Partial<Record<keyof DirFilter, string | string[] | number>> = {}): string {
  const merged = { ...f, ...patch } as Record<string, unknown>;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (k === "page" && Number(v) <= 1) continue;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else if (v !== "" && v !== undefined && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const f = parseDirFilter(await searchParams);
  const viewer = await getViewer();
  const account = viewerAccount(viewer);

  // FR-DIR-09 — searches per signed-in account; anonymous traffic shares one ceiling.
  const limited = account
    ? await hit(LIMITS.directorySearch, account.id)
    : await hit(LIMITS.directoryAnon, "all");
  if (limited) {
    return (
      <>
        <PageHead crumb="ทำเนียบศิษย์เก่า" title="ทำเนียบศิษย์เก่า" />
        <section className="section">
          <div className="wrap">
            <p className="flash flash-warn" role="alert">มีการค้นหาถี่เกินไป กรุณารอสักครู่แล้วลองใหม่</p>
          </div>
        </section>
      </>
    );
  }

  const [{ people, total }, facets] = await Promise.all([searchDirectory(f, viewer), getFacets(f)]);
  const pages = Math.max(1, Math.ceil(total / DIR_PAGE_SIZE));
  const active = FACETS.flatMap(({ key }) =>
    (f[key] as string[]).map((v) => {
      const label = facets[key].find((o: FacetOption) => o.value === v)?.label ?? v;
      return { key, v, label };
    }),
  );

  return (
    <>
      <PageHead
        crumb="ทำเนียบศิษย์เก่า"
        title="ทำเนียบศิษย์เก่า"
        lead="ค้นหาเพื่อนร่วมรุ่นและรุ่นพี่รุ่นน้อง — ตามชื่อ ชื่อเดิม ชื่อเล่น รุ่น สาขา จังหวัด กลุ่มอาชีพ และทักษะ"
      />
      <section className="section">
        <div className="wrap">
          <p className="small" style={{ marginTop: -8 }}>
            <Link href="/directory/cohorts">ดูทำเนียบแยกตามรุ่น →</Link>
          </p>
          {/* A plain GET form: filters live in the URL, so results can be bookmarked and shared,
              and the page works without JavaScript. */}
          <form method="get" className="directory">
            <aside className="facets" aria-label="ตัวกรองการค้นหา">
              {FACETS.map(({ key, label }) =>
                facets[key].length ? (
                  <fieldset className="facet" key={key} style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend><h3 style={{ margin: 0 }}>{label}</h3></legend>
                    {facets[key].map((o) => (
                      <label key={o.value}>
                        <input type="checkbox" name={key} value={o.value} defaultChecked={(f[key] as string[]).includes(o.value)} />
                        {o.label}
                        <span className="count">{formatNumber(o.count)}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : null,
              )}
              <button type="submit" className="btn btn-primary btn-sm facet-reset" style={{ width: "100%" }}>ใช้ตัวกรอง</button>
              {active.length || f.q ? (
                <Link href="/directory" className="btn btn-outline btn-sm" style={{ width: "100%", marginTop: 8 }}>ล้างตัวกรองทั้งหมด</Link>
              ) : null}
            </aside>

            <div>
              <div className="search-row">
                <div className="field">
                  <label htmlFor="dir-q">ค้นหาศิษย์เก่า</label>
                  <input id="dir-q" name="q" type="search" defaultValue={f.q} placeholder="ชื่อ นามสกุล ชื่อเดิม ชื่อเล่น หรือที่ทำงาน" />
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>ค้นหา</button>
              </div>

              {active.length ? (
                <div className="active-filters">
                  {active.map((a) => (
                    <Link
                      key={`${a.key}-${a.v}`}
                      className="filter-chip"
                      href={`/directory${toQuery(f, { [a.key]: (f[a.key] as string[]).filter((x) => x !== a.v), page: 1 })}`}
                    >
                      {a.label} <span aria-hidden="true">✕</span>
                      <span className="sr-only">นำตัวกรองออก</span>
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="result-bar">
                <p className="result-count">
                  พบ <strong>{formatNumber(total)}</strong> คน{pages > 1 ? ` · หน้า ${f.page}/${pages}` : ""}
                </p>
              </div>

              {people.length ? (
                <div className="person-list">
                  {people.map((p) => (
                    <DirectoryCard key={p.id} p={p} signedIn={viewer.kind !== "anonymous"} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p><strong>ไม่พบศิษย์เก่าที่ตรงกับเงื่อนไข</strong></p>
                  <p style={{ marginBottom: 0 }}>ลองลดตัวกรอง หรือค้นด้วยชื่อเดิมก่อนเปลี่ยนชื่อ-นามสกุล</p>
                </div>
              )}

              {pages > 1 ? (
                <nav className="pager" aria-label="เลือกหน้า">
                  {f.page > 1 ? <Link className="btn btn-outline btn-sm" href={`/directory${toQuery(f, { page: f.page - 1 })}`}>← ก่อนหน้า</Link> : null}
                  <span>หน้า {f.page} / {pages}</span>
                  {f.page < pages ? <Link className="btn btn-outline btn-sm" href={`/directory${toQuery(f, { page: f.page + 1 })}`}>ถัดไป →</Link> : null}
                </nav>
              ) : null}

              <div className="privacy-note">
                <p>
                  <strong>ความเป็นส่วนตัว:</strong> แสดงเฉพาะศิษย์เก่าที่ยืนยันตัวตนแล้วและยินยอมให้แสดงในทำเนียบ
                  ข้อมูลแต่ละช่องแสดงตามที่เจ้าของเลือกไว้
                  {isMember(viewer) ? "" : " — ข้อมูลติดต่อส่วนใหญ่เห็นได้เฉพาะศิษย์เก่าที่ยืนยันตัวตนแล้ว"}
                  {" "}และระบบบันทึกประวัติการเปิดดูโปรไฟล์ไว้ตรวจสอบได้
                </p>
              </div>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
