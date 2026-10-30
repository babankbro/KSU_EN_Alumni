"use client";

import { useActionState, useState } from "react";
import { replaceImageAction, resetImageAction, type FormState } from "@/app/admin/actions";

export interface ImageSlotDef {
  slot: string;
  label: string;
  hint: string | null;
  alt: string;
  currentSrc: string | null;
  isCustom: boolean;
}

export default function ImageSlotForm({ def }: { def: ImageSlotDef }) {
  const [state, action, pending] = useActionState<FormState, FormData>(replaceImageAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? def.currentSrc;
  const inputId = `img-${def.slot.replace(/\./g, "-")}`;

  return (
    <div className="image-slot">
      <div className="image-slot-preview">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={preview ? "ตัวอย่างรูปใหม่ (ยังไม่บันทึก)" : def.alt} />
        ) : (
          <span>ยังไม่มีรูป — ใช้ภาพแทนแบบสีพื้น</span>
        )}
      </div>
      <div className="image-slot-body">
        <h3>
          {def.label}{" "}
          <span className={`pill ${def.isCustom ? "pill-published" : "pill-draft"}`}>
            {def.isCustom ? "รูปที่อัปโหลด" : "รูปเริ่มต้น"}
          </span>
        </h3>
        {def.hint ? <p className="field-hint">{def.hint}</p> : null}

        {state.error ? <p className="flash flash-error" role="alert">{state.error}</p> : null}
        {state.ok ? <p className="flash flash-ok" role="status">{state.ok}</p> : null}

        <form action={action} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="slot" value={def.slot} />
          <div className="field">
            <label htmlFor={inputId}>เลือกรูปใหม่</label>
            <input
              id={inputId}
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={`${inputId}-alt`}>คำอธิบายรูป (สำหรับผู้ใช้โปรแกรมอ่านหน้าจอ)</label>
            <input id={`${inputId}-alt`} type="text" name="alt" maxLength={200} defaultValue={def.alt} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending}>
            {pending ? "กำลังอัปโหลด…" : "บันทึกรูปนี้"}
          </button>
        </form>

        {def.isCustom ? (
          <form action={resetImageAction}>
            <input type="hidden" name="slot" value={def.slot} />
            <button type="submit" className="btn btn-outline btn-sm" style={{ width: "100%" }}>
              คืนค่าเป็นรูปเริ่มต้น
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
