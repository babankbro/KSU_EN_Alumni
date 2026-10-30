import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { findDuplicates } from "@/lib/server/data-admin";
import { CLAIM_STATUS_LABEL, type ClaimStatus } from "@/lib/server/members";
import { mergeAction } from "../../data-actions";

export const metadata = { title: "ระเบียนที่อาจซ้ำกัน" };

/** FR-ADM-02 — likely duplicates, merged only after an admin confirms. */
export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await requireAdmin("admin");
  const { done } = await searchParams;
  const pairs = await findDuplicates();

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ระเบียนที่อาจซ้ำกัน</h1>
          <p>สาขาเดียวกัน รุ่นห่างกันไม่เกิน 1 ปี และชื่อ (หรือชื่อเดิม) ใกล้เคียงกัน — ตรวจสอบก่อนรวมทุกครั้ง</p>
        </div>
      </div>
      {done === "merged" ? <p className="flash flash-ok" role="status">รวมระเบียนแล้ว — ชื่อของระเบียนที่ถูกรวมถูกเก็บเป็นชื่อเดิม และบันทึกสำเนาไว้</p> : null}
      {done === "need_confirm" ? <p className="flash flash-warn" role="alert">กรุณาเลือกระเบียนที่จะเก็บไว้และติ๊กยืนยันก่อนรวม</p> : null}
      {pairs.length === 0 ? <p className="admin-card muted">ไม่พบระเบียนที่น่าจะซ้ำกัน</p> : null}

      {pairs.map((p) => (
        <form key={`${p.a.id}${p.b.id}`} action={mergeAction} className="admin-card mod-item">
          <input type="hidden" name="a" value={p.a.id} />
          <input type="hidden" name="b" value={p.b.id} />
          <p className="small muted" style={{ margin: 0 }}>{p.reason} · ความใกล้เคียงของชื่อ {(p.score * 100).toFixed(0)}%</p>
          <div className="admin-grid-2" style={{ marginTop: 8 }}>
            {[p.a, p.b].map((r) => (
              <label key={r.id} className="dup-option">
                <input type="radio" name="keep" value={r.id} />
                <span>
                  <strong>เก็บระเบียนนี้:</strong> <Link href={`/admin/members/${r.id}`}>{r.name}</Link>
                  <br />
                  <span className="small">รหัส {r.code ?? "—"} · รุ่น {r.cohort} · {r.program} · {CLAIM_STATUS_LABEL[r.status as ClaimStatus] ?? r.status}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="check-row" style={{ marginTop: 8 }}>
            <input type="checkbox" name="confirm" /> <span>ตรวจแล้วว่าเป็นคนเดียวกัน — รวมข้อมูลทั้งหมดเข้าระเบียนที่เลือก แล้วลบอีกระเบียน</span>
          </label>
          <div className="review-actions"><button type="submit" className="btn btn-primary">รวมระเบียน</button></div>
        </form>
      ))}
    </>
  );
}
