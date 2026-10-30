"use client";

import { useActionState } from "react";
import { useKeepValues } from "@/components/forms/useKeepValues";
import { loginAction, type FormState } from "@/app/admin/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const keepValues = useKeepValues(action);

  return (
    <form action={action} onSubmit={keepValues} noValidate>
      {state.error ? (
        <p className="flash flash-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="email">อีเมล</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">รหัสผ่าน</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
