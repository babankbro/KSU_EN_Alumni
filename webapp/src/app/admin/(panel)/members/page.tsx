import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import {
  CLAIM_STATUS_LABEL,
  PAGE_SIZE,
  getMemberStats,
  listMembers,
  thaiDate,
  type ClaimStatus,
} from "@/lib/server/members";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "สมาชิก" };

const STATUSES: ClaimStatus[] = ["pending", "verified", "unclaimed", "rejected"];
const LEVELS = ["ปวส.", "อส.บ.", "ทล.บ.", "วศ.บ.", "สถ.บ."];

type SP = { q?: string; status?: string; level?: string; page?: string };

function qs(base: SP, patch: Partial<SP>): string {
  const merged = { ...base, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin(["admin", "faculty"]);
  const sp = await searchParams;

  const status = STATUSES.includes(sp.status as ClaimStatus) ? (sp.status as ClaimStatus) : "";
  const level = LEVELS.includes(sp.level ?? "") ? sp.level! : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").slice(0, 100);

  const [stats, { rows, total }] = await Promise.all([
    getMemberStats(),
    listMembers({ q, status, level, page }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current: SP = { q, status, level };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>สมาชิก</h1>
          <p>
            ทั้งหมด {formatNumber(stats.total)} ระเบียน · ยืนยันแล้ว {formatNumber(stats.byStatus.verified)} ·
            รอตรวจสอบ {formatNumber(stats.byStatus.pending)}
          </p>
        </div>
      </div>

      {/* Status counts double as filters */}
      <div className="kpis">
        <Link href={`/admin/members${qs(current, { status: "", page: "" })}`} className="kpi">
          <div className="kpi-label">ทั้งหมด</div>
          <div className="kpi-value">{formatNumber(stats.total)}</div>
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/members${qs(current, { status: s, page: "" })}`}
            className={`kpi${s === "pending" && stats.byStatus.pending ? " kpi-alert" : ""}`}
            aria-current={status === s ? "true" : undefined}
            style={status === s ? { borderColor: "var(--color-primary-700)", boxShadow: "var(--focus-ring)" } : undefined}
          >
            <div className="kpi-label">{CLAIM_STATUS_LABEL[s]}</div>
            <div className="kpi-value">{formatNumber(stats.byStatus[s])}</div>
          </Link>
        ))}
      </div>

      <form className="filter-bar" method="get">
        <div className="field">
          <label htmlFor="q">ค้นหา</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="ชื่อ ชื่อเดิม ชื่อเล่น รหัสนักศึกษา หรืออีเมล"
          />
        </div>
        <div className="field narrow">
          <label htmlFor="status">สถานะ</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="">ทุกสถานะ</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{CLAIM_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="field narrow">
          <label htmlFor="level">ระดับการศึกษา</label>
          <select id="level" name="level" defaultValue={level}>
            <option value="">ทุกระดับ</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">ค้นหา</button>
        {q || status || level ? (
          <Link href="/admin/members" className="btn btn-outline">ล้างตัวกรอง</Link>
        ) : null}
        <a href={`/admin/members/export${qs(current, { page: "" })}`} className="btn btn-outline">
          ⬇ ส่งออก CSV
        </a>
      </form>

      <p className="small muted">
        พบ {formatNumber(total)} รายการ{total > PAGE_SIZE ? ` · หน้า ${page} จาก ${pages}` : ""} — ระบบบันทึกประวัติทุกครั้งที่เปิดดูข้อมูลสมาชิก
      </p>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">ชื่อ</th>
              <th scope="col">รหัสนักศึกษา</th>
              <th scope="col">ระดับ / สาขา</th>
              <th scope="col" className="num">รุ่น</th>
              <th scope="col">ติดต่อ</th>
              <th scope="col">สถานะ</th>
              <th scope="col">อัปเดตล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 32 }}>
                  ไม่พบสมาชิกที่ตรงกับเงื่อนไข
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/members/${m.id}`}>
                      <strong>{m.name}</strong>
                    </Link>
                    {m.nickname ? <span className="muted"> ({m.nickname})</span> : null}
                  </td>
                  <td>{m.studentCode ?? <span className="muted">—</span>}</td>
                  <td>
                    {m.level} {m.program}
                    {m.program !== m.programCurrent ? (
                      <div className="small muted">ปัจจุบัน: {m.programCurrent}</div>
                    ) : null}
                  </td>
                  <td className="num">
                    {m.admissionYear}
                    {m.graduationYear ? <div className="small muted">จบ {m.graduationYear}</div> : null}
                  </td>
                  <td className="small">
                    {m.email ?? <span className="muted">—</span>}
                    {m.province ? <div className="muted">{m.province}</div> : null}
                  </td>
                  <td>
                    <span className={`pill pill-${m.status}`}>{CLAIM_STATUS_LABEL[m.status]}</span>
                  </td>
                  <td className="small muted">{thaiDate(m.profileUpdatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav className="pager" aria-label="เลือกหน้า">
          {page > 1 ? (
            <Link className="btn btn-outline btn-sm" href={`/admin/members${qs(current, { page: String(page - 1) })}`}>
              ← ก่อนหน้า
            </Link>
          ) : null}
          <span>หน้า {page} / {pages}</span>
          {page < pages ? (
            <Link className="btn btn-outline btn-sm" href={`/admin/members${qs(current, { page: String(page + 1) })}`}>
              ถัดไป →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
