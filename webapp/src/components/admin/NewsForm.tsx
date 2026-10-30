"use client";

import { useActionState, useState } from "react";
import { useKeepValues } from "@/components/forms/useKeepValues";
import { saveNewsAction, type FormState } from "@/app/admin/actions";

export interface NewsFormValues {
  id?: number;
  title: string;
  summary: string;
  body: string;
  category: string;
  isPinned: boolean;
  /** draft | now | schedule */
  publishMode: "draft" | "now" | "schedule";
  /** "YYYY-MM-DDTHH:mm" in Bangkok time, for scheduled items */
  publishAt: string;
  coverUrl: string | null;
}

const CATEGORIES = ["ข่าวคณะ", "ทุนการศึกษา", "ศิษย์เก่าดีเด่น", "กิจกรรม", "แบบสำรวจ", "ประกันคุณภาพ", "รับสมัครงาน"];

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <p className="char-count" aria-live="polite">
      {value.length}/{max}
    </p>
  );
}

export default function NewsForm({ initial }: { initial: NewsFormValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveNewsAction, {});
  const keepValues = useKeepValues(action);
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [mode, setMode] = useState(initial.publishMode);
  const [preview, setPreview] = useState<string | null>(initial.coverUrl);
  const [removeCover, setRemoveCover] = useState(false);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} onSubmit={keepValues} className="admin-card" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.error ? <p className="flash flash-error" role="alert">{state.error}</p> : null}

      <div className="settings-fields">
        <div className={`field${fe.title ? " has-error" : ""}`}>
          <label htmlFor="title">หัวข้อข่าว <span className="required">*</span></label>
          <input id="title" name="title" type="text" maxLength={200} value={title}
            onChange={(e) => setTitle(e.target.value)} aria-invalid={fe.title ? true : undefined} />
          <Counter value={title} max={200} />
          {fe.title ? <p className="field-error">{fe.title}</p> : null}
        </div>

        <div className={`field${fe.summary ? " has-error" : ""}`}>
          <label htmlFor="summary">สรุปสั้น (แสดงบนการ์ดข่าว)</label>
          <textarea id="summary" name="summary" rows={2} maxLength={400} value={summary}
            onChange={(e) => setSummary(e.target.value)} />
          <Counter value={summary} max={400} />
          {fe.summary ? <p className="field-error">{fe.summary}</p> : null}
        </div>

        <div className={`field${fe.body ? " has-error" : ""}`}>
          <label htmlFor="body">เนื้อหาข่าว</label>
          <textarea id="body" name="body" rows={12} defaultValue={initial.body} />
          <p className="field-hint">เว้นบรรทัดว่างหนึ่งบรรทัดเพื่อขึ้นย่อหน้าใหม่</p>
          {fe.body ? <p className="field-error">{fe.body}</p> : null}
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="category">หมวดข่าว</label>
            <input id="category" name="category" type="text" list="news-categories" maxLength={60}
              defaultValue={initial.category} />
            <datalist id="news-categories">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label className="radio-row" style={{ fontWeight: 400 }}>
              <span style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 48 }}>
                <input type="checkbox" name="isPinned" defaultChecked={initial.isPinned} />
                ปักหมุดไว้บนสุด
              </span>
            </label>
          </div>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: 8 }}>ภาพปกข่าว</legend>
          <div className="photo-row">
            {preview && !removeCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="ตัวอย่างภาพปก" style={{ width: 220, aspectRatio: "16/10", objectFit: "cover", borderRadius: 8 }} />
            ) : null}
            <div style={{ display: "grid", gap: 8 }}>
              <input
                type="file"
                name="cover"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPreview(URL.createObjectURL(f));
                    setRemoveCover(false);
                  }
                }}
              />
              <p className="field-hint">JPG, PNG หรือ WebP ไม่เกิน 8 MB · สัดส่วนแนะนำ 16:10 · ถ้าไม่ใส่จะใช้ภาพปกเริ่มต้น</p>
              {initial.coverUrl ? (
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="removeCover" checked={removeCover}
                    onChange={(e) => setRemoveCover(e.target.checked)} />
                  นำภาพปกเดิมออก
                </label>
              ) : null}
              {fe.cover ? <p className="field-error">{fe.cover}</p> : null}
            </div>
          </div>
        </fieldset>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: 8 }}>การเผยแพร่</legend>
          <div className="radio-row">
            {(
              [
                ["draft", "บันทึกเป็นฉบับร่าง"],
                ["now", initial.id && initial.publishMode === "now" ? "เผยแพร่อยู่ (คงวันที่เดิม)" : "เผยแพร่ทันที"],
                ["schedule", "ตั้งเวลาเผยแพร่"],
              ] as const
            ).map(([v, label]) => (
              <label key={v}>
                <input type="radio" name="publishMode" value={v} checked={mode === v} onChange={() => setMode(v)} />
                {label}
              </label>
            ))}
          </div>
          {mode === "schedule" ? (
            <div className={`field${fe.publishAt ? " has-error" : ""}`} style={{ maxWidth: 320 }}>
              <label htmlFor="publishAt">วันเวลาที่จะเผยแพร่ (เวลาประเทศไทย)</label>
              <input id="publishAt" name="publishAt" type="datetime-local" defaultValue={initial.publishAt} />
              {fe.publishAt ? <p className="field-error">{fe.publishAt}</p> : null}
            </div>
          ) : null}
        </fieldset>
      </div>

      <div className="sticky-save">
        <a href="/admin/news" className="btn btn-outline">ยกเลิก</a>
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึกข่าว"}
        </button>
      </div>
    </form>
  );
}
