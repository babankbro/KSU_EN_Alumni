import ActionForm from "@/components/forms/ActionForm";
import Field, { Check } from "@/components/forms/Field";
import { toLocalInput, type EventData } from "@/lib/server/events";
import { saveEventAction } from "../../event-actions";

/** FR-EVT-01 — create or edit an event. Times are entered in Bangkok time. */
export default function EventForm({ e }: { e?: EventData }) {
  return (
    <ActionForm action={saveEventAction} encType="multipart/form-data" submitLabel={e ? "บันทึกการแก้ไข" : "สร้างกิจกรรม"}>
      {e ? <input type="hidden" name="recordId" value={e.id} /> : null}
      <Field name="title" label="ชื่อกิจกรรม" defaultValue={e?.title} maxLength={200} required />
      <div className="field-grid">
        <Field name="startsAt" type="datetime-local" label="เริ่ม" defaultValue={toLocalInput(e?.startsAt ?? null)} required />
        <Field name="endsAt" type="datetime-local" label="สิ้นสุด (ไม่บังคับ)" defaultValue={toLocalInput(e?.endsAt ?? null)} />
      </div>
      <Field name="venue" label="สถานที่ หรือช่องทางออนไลน์" defaultValue={e?.venue} maxLength={200} />
      <Check name="isOnline" label="จัดออนไลน์" defaultChecked={e?.isOnline} />
      <Field as="textarea" name="description" label="รายละเอียด" rows={6} maxLength={10000} defaultValue={e?.description} />
      <div className="field-grid">
        <Field name="capacity" type="number" label="จำนวนที่รับ (เว้นว่างถ้าไม่จำกัด)" defaultValue={e?.capacity} min={1} />
        <Field name="registrationClosesAt" type="datetime-local" label="ปิดรับลงทะเบียน (ไม่บังคับ)" defaultValue={toLocalInput(e?.registrationClosesAt ?? null)} />
      </div>
      <Check name="registrationOpen" label="เปิดรับลงทะเบียน" defaultChecked={e?.registrationOpen ?? true} />
      <div className="field">
        <label htmlFor="cover">ภาพปก (JPG, PNG, WebP ไม่เกิน 8 MB)</label>
        {e?.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.coverUrl} alt="ภาพปกปัจจุบัน" className="post-image-preview" />
        ) : null}
        <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      {e?.coverUrl ? <Check name="removeCover" label="นำภาพปกออก" /> : null}
      <Check name="isPublished" label="เผยแพร่บนหน้าเว็บ" defaultChecked={e?.isPublished ?? true} hint="ไม่ติ๊ก = เก็บเป็นฉบับร่าง ผู้เยี่ยมชมจะไม่เห็น" />
    </ActionForm>
  );
}
