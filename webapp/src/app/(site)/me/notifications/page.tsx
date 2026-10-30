import Link from "next/link";
import { requireMember } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";
import { NOTIF_TYPES } from "@/lib/server/notify";
import { lineLoginEnabled } from "@/lib/server/line";
import { formatThaiDateTime } from "@/lib/server/format-server";
import ActionForm from "@/components/forms/ActionForm";
import { markAllReadAction, savePrefsAction } from "../actions";

export const metadata = { title: "การแจ้งเตือน" };

export default async function NotificationsPage() {
  const acc = await requireMember();
  const [inbox, prefs] = await Promise.all([
    query<{ title: string; body: string; link: string | null; created_at: Date; read_at: Date | null }>(
      `SELECT title, body, link, created_at, read_at FROM notification
       WHERE account_id = $1 AND channel = 'in_app' ORDER BY created_at DESC LIMIT 50`,
      [acc.id],
    ),
    query<{ type: string; in_app: boolean; email: boolean; line: boolean; frequency: string }>(
      `SELECT type, in_app, email, line, frequency FROM notification_pref WHERE account_id = $1`,
      [acc.id],
    ),
  ]);
  const pref = Object.fromEntries(prefs.map((p) => [p.type, p]));
  const lineAvailable = acc.lineLinked && Boolean(process.env.LINE_MESSAGING_ACCESS_TOKEN);

  return (
    <>
      <div className="admin-head">
        <h1>การแจ้งเตือน</h1>
        <form action={markAllReadAction}><button type="submit" className="btn btn-outline btn-sm">อ่านทั้งหมดแล้ว</button></form>
      </div>

      <section className="admin-card">
        {inbox.length === 0 ? (
          <p className="muted">ยังไม่มีการแจ้งเตือน</p>
        ) : (
          <ul className="list-plain">
            {inbox.map((n, i) => (
              <li key={i} className={n.read_at ? undefined : "notif-unread"}>
                <strong>{n.link ? <Link href={n.link}>{n.title}</Link> : n.title}</strong>
                <div className="small" style={{ whiteSpace: "pre-line" }}>{n.body}</div>
                <div className="small muted">{formatThaiDateTime(n.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActionForm action={savePrefsAction} submitLabel="บันทึกการตั้งค่า">
        <h2 style={{ fontSize: 18, margin: 0 }}>ตั้งค่าการแจ้งเตือน</h2>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>ประเภท</th><th>ในเว็บ</th><th>อีเมล</th><th>LINE</th><th>ความถี่</th></tr>
            </thead>
            <tbody>
              {NOTIF_TYPES.map(({ type, label }) => {
                const p = pref[type] ?? { in_app: true, email: true, line: false, frequency: "immediate" };
                return (
                  <tr key={type}>
                    <td>{label}</td>
                    <td><input type="checkbox" name={`in_app_${type}`} defaultChecked={p.in_app} aria-label={`${label} ในเว็บ`} /></td>
                    <td><input type="checkbox" name={`email_${type}`} defaultChecked={p.email} aria-label={`${label} อีเมล`} /></td>
                    <td>
                      <input type="checkbox" name={`line_${type}`} defaultChecked={p.line} disabled={!lineAvailable} aria-label={`${label} LINE`} />
                    </td>
                    <td>
                      <select name={`freq_${type}`} defaultValue={p.frequency} aria-label={`${label} ความถี่`}>
                        <option value="immediate">ทันที</option>
                        <option value="weekly">สรุปรายสัปดาห์</option>
                        <option value="off">ปิด</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          {lineAvailable
            ? "LINE ส่งถึงบัญชี LINE ที่เชื่อมไว้"
            : lineLoginEnabled()
              ? "เชื่อมบัญชี LINE ที่หน้า “บัญชีและรหัสผ่าน” เพื่อรับแจ้งเตือนทาง LINE"
              : "การแจ้งเตือนทาง LINE ยังไม่เปิดใช้"}
          {" · "}อีเมลเรื่องบัญชี (เช่น ตั้งรหัสผ่านใหม่) ส่งเสมอและปิดไม่ได้
        </p>
      </ActionForm>
    </>
  );
}
