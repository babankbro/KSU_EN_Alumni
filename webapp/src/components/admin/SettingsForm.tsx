"use client";

import { useActionState } from "react";
import { useKeepValues } from "@/components/forms/useKeepValues";
import { saveSettingsAction, type FormState } from "@/app/admin/actions";

export interface SettingDef {
  key: string;
  grp: string;
  label: string;
  kind: "text" | "textarea" | "email" | "phone" | "url";
  value: string;
  maxLength: number;
}

const INPUT_TYPE: Record<SettingDef["kind"], string> = {
  text: "text",
  textarea: "text",
  email: "email",
  phone: "tel",
  url: "url",
};

export default function SettingsForm({ groups }: { groups: { name: string; items: SettingDef[] }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettingsAction, {});
  const keepValues = useKeepValues(action);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} onSubmit={keepValues} className="admin-card" noValidate>
      <h2>ข้อความบนเว็บไซต์</h2>
      {state.error ? <p className="flash flash-error" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="flash flash-ok" role="status">{state.ok}</p> : null}

      {groups.map((g) => (
        <div className="settings-group" key={g.name}>
          <h3>{g.name}</h3>
          <div className="settings-fields">
            {g.items.map((s) => {
              const id = `s-${s.key.replace(/\./g, "-")}`;
              const err = fe[s.key];
              return (
                <div className={`field${err ? " has-error" : ""}`} key={s.key}>
                  <label htmlFor={id}>{s.label}</label>
                  {s.kind === "textarea" ? (
                    <textarea id={id} name={`s:${s.key}`} rows={3} maxLength={s.maxLength} defaultValue={s.value}
                      aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-err` : undefined} />
                  ) : (
                    <input id={id} name={`s:${s.key}`} type={INPUT_TYPE[s.kind]} maxLength={s.maxLength}
                      defaultValue={s.value} placeholder={s.kind === "url" ? "https://" : undefined}
                      aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-err` : undefined} />
                  )}
                  {s.kind === "url" ? (
                    <p className="field-hint">เว้นว่างไว้ถ้าไม่ต้องการแสดงไอคอนนี้</p>
                  ) : null}
                  {err ? <p className="field-error" id={`${id}-err`}>{err}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="sticky-save">
        <span className="small muted">การเปลี่ยนแปลงแสดงบนเว็บทันทีหลังบันทึก</span>
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึกข้อความ"}
        </button>
      </div>
    </form>
  );
}
