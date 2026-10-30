import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";
import SettingsForm, { type SettingDef } from "@/components/admin/SettingsForm";
import ImageSlotForm from "@/components/admin/ImageSlotForm";

export const metadata = { title: "ข้อมูลและรูปภาพเว็บ" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  await requireAdmin(["admin", "editor"]);
  const { reset } = await searchParams;

  const [settings, images] = await Promise.all([
    query<{ key: string; grp: string; label: string; kind: SettingDef["kind"]; value: string; max_length: number }>(
      `SELECT key, grp, label, kind, value, max_length FROM site_setting ORDER BY grp, sort_order`,
    ),
    query<{ slot: string; label: string; hint: string | null; fallback_path: string; alt_text: string; file_id: string | null }>(
      `SELECT slot, label, hint, fallback_path, alt_text, file_id FROM site_image ORDER BY slot = 'hero' DESC, slot`,
    ),
  ]);

  // Keep the groups in the order they appear on the page, not alphabetical.
  const GROUP_ORDER = ["หน้าแรก — ส่วนหัว (Hero)", "หน้าแรก — สารจากคณบดี", "ข้อมูลติดต่อ", "ลิงก์โซเชียล", "ส่วนท้ายเว็บ"];
  const groups = new Map<string, SettingDef[]>();
  for (const s of settings) {
    const list = groups.get(s.grp) ?? [];
    list.push({ key: s.key, grp: s.grp, label: s.label, kind: s.kind, value: s.value, maxLength: s.max_length });
    groups.set(s.grp, list);
  }
  const ordered = [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map(([name, items]) => ({ name, items }));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>ข้อมูลและรูปภาพเว็บ</h1>
          <p>แก้ไขข้อความและเปลี่ยนรูปบนเว็บไซต์ — โครงหน้าและสีคงไว้ตามแนวทางออกแบบ</p>
        </div>
      </div>

      {reset ? <p className="flash flash-ok" role="status">คืนค่ารูปเริ่มต้นแล้ว</p> : null}

      <section className="admin-card" id="images">
        <h2>รูปภาพ</h2>
        <div className="image-slots">
          {images.map((i) => (
            <ImageSlotForm
              key={i.slot}
              def={{
                slot: i.slot,
                label: i.label,
                hint: i.hint,
                alt: i.alt_text,
                currentSrc: i.file_id ? fileUrl(i.file_id) : i.fallback_path || null,
                isCustom: Boolean(i.file_id),
              }}
            />
          ))}
        </div>
      </section>

      <SettingsForm groups={ordered} />
    </>
  );
}
