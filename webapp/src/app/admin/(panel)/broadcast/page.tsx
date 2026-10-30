import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { thaiDateTime } from "@/lib/server/members";
import { audienceAccounts, parseAudience } from "@/lib/server/audience";
import ActionForm from "@/components/forms/ActionForm";
import Field, { Check } from "@/components/forms/Field";
import { sendBroadcastAction, startDataConfirmRoundAction } from "../../broadcast-actions";

export const metadata = { title: "ส่งประกาศ" };

const LEVELS = ["ปวส.", "อส.บ.", "ทล.บ.", "วศ.บ.", "สถ.บ."];

/** FR-NOTI-05 broadcasts to a chosen group, and FR-NOTI-04 data-confirmation rounds. */
export default async function BroadcastPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("admin");
  const sp = await searchParams;
  const f = parseAudience((k) => (sp[k] ?? "").trim());
  const [count, programs, history, rounds] = await Promise.all([
    audienceAccounts(f).then((ids) => ids.length),
    query<{ id: number; name: string }>(`SELECT DISTINCT current_id AS id, degree_level::text || ' ' || current_name_th AS name FROM program_resolved WHERE id = current_id ORDER BY name`),
    query<{ title: string; recipient_count: number; created_at: Date; who: string | null }>(
      `SELECT b.title, b.recipient_count, b.created_at, u.display_name AS who FROM broadcast b LEFT JOIN admin_user u ON u.id = b.created_by ORDER BY b.created_at DESC LIMIT 10`,
    ),
    query<{ stale_months: number; recipient_count: number; created_at: Date }>(`SELECT stale_months, recipient_count, created_at FROM data_confirm_round ORDER BY created_at DESC LIMIT 5`),
  ]);
  const hidden = { who: f.who, cohortFrom: f.cohortFrom ? String(f.cohortFrom) : "", cohortTo: f.cohortTo ? String(f.cohortTo) : "", program: f.program ? String(f.program) : "", level: f.level };

  return (
    <>
      <div className="admin-head">
        <div><h1>ส่งประกาศ</h1><p>ข้อความถึงกลุ่มเป้าหมาย ผ่านกล่องแจ้งเตือน อีเมล และ LINE ตามที่แต่ละคนตั้งค่าไว้</p></div>
      </div>

      <form className="filter-bar" method="get">
        <div className="field narrow">
          <label htmlFor="who">ผู้รับ</label>
          <select id="who" name="who" defaultValue={f.who}>
            <option value="alumni">ศิษย์เก่าที่ยืนยันแล้ว</option>
            <option value="students">นักศึกษาปัจจุบัน</option>
            <option value="all">ทั้งสองกลุ่ม</option>
          </select>
        </div>
        <div className="field narrow"><label htmlFor="cf">รุ่นตั้งแต่</label><input id="cf" name="cohortFrom" inputMode="numeric" defaultValue={sp.cohortFrom ?? ""} placeholder="พ.ศ." /></div>
        <div className="field narrow"><label htmlFor="ct">ถึงรุ่น</label><input id="ct" name="cohortTo" inputMode="numeric" defaultValue={sp.cohortTo ?? ""} placeholder="พ.ศ." /></div>
        <div className="field">
          <label htmlFor="bp">สาขา</label>
          <select id="bp" name="program" defaultValue={sp.program ?? ""}>
            <option value="">ทุกสาขา</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field narrow">
          <label htmlFor="bl">ระดับ</label>
          <select id="bl" name="level" defaultValue={f.level}>
            <option value="">ทุกระดับ</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-outline">นับผู้รับ</button>
      </form>
      <p aria-live="polite"><strong>ผู้รับตามเงื่อนไขนี้: {count.toLocaleString("th-TH")} บัญชี</strong>
        {f.who !== "alumni" && (f.cohortFrom || f.cohortTo || f.program || f.level) ? <span className="small muted"> — นักศึกษาไม่มีข้อมูลรุ่น/สาขา จึงไม่รวมเมื่อกรองตามรุ่นหรือสาขา</span> : null}
      </p>

      <ActionForm action={sendBroadcastAction} submitLabel="ส่งประกาศ" pendingLabel="กำลังส่ง…" resetOnSuccess>
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <Field name="title" label="หัวข้อ" maxLength={150} required />
        <Field as="textarea" name="body" label="ข้อความ" rows={5} maxLength={3000} required />
        <Field name="link" label="ลิงก์ในเว็บไซต์ (ไม่บังคับ)" placeholder="/events/1" />
        <Check name="confirm" label={`ยืนยันการส่งถึง ${count.toLocaleString("th-TH")} บัญชี`} />
      </ActionForm>

      <ActionForm action={startDataConfirmRoundAction} submitLabel="ส่งคำเชิญยืนยันข้อมูล" pendingLabel="กำลังส่ง…">
        <h2 style={{ fontSize: 18, margin: 0 }}>รอบยืนยันความถูกต้องของข้อมูล</h2>
        <p className="small muted" style={{ margin: 0 }}>เชิญศิษย์เก่าที่ไม่ได้อัปเดตข้อมูลนานเกินกำหนดให้ตรวจสอบโปรไฟล์ — กด “ข้อมูลยังถูกต้อง” ได้ในคลิกเดียว</p>
        <Field name="months" type="number" label="ไม่ได้อัปเดตนานกว่า (เดือน)" defaultValue={12} min={3} max={60} />
        <Check name="confirm" label="ยืนยันการส่ง" />
      </ActionForm>

      <div className="admin-grid-2">
        <section className="admin-card">
          <h2>ประกาศล่าสุด</h2>
          {history.length ? <ul className="list-plain small">{history.map((h, i) => <li key={i}><strong>{h.title}</strong> · {h.recipient_count} คน · {thaiDateTime(h.created_at)} · {h.who ?? "—"}</li>)}</ul> : <p className="muted">ยังไม่เคยส่ง</p>}
        </section>
        <section className="admin-card">
          <h2>รอบยืนยันข้อมูล</h2>
          {rounds.length ? <ul className="list-plain small">{rounds.map((r, i) => <li key={i}>เก่ากว่า {r.stale_months} เดือน · {r.recipient_count} คน · {thaiDateTime(r.created_at)}</li>)}</ul> : <p className="muted">ยังไม่เคยส่ง</p>}
        </section>
      </div>
    </>
  );
}
