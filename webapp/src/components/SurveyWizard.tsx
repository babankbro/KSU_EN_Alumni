"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { isShown, type Answers, type Question } from "@/lib/surveys";
import type { FormState } from "@/lib/form-state";

const PER_STEP = 3;

/**
 * FR-SVY-02 — a survey shown a few questions at a time, with progress, so it
 * does not look like a wall of fields. Answers that come from the profile
 * (FR-SVY-03) are filled in and can be changed. Questions with showIf appear
 * only when they apply.
 */
export default function SurveyWizard({
  questions,
  initial,
  action,
  hidden,
}: {
  questions: Question[];
  initial: Answers;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [step, setStep] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [, startTransition] = useTransition();
  const headRef = useRef<HTMLHeadingElement>(null);

  const visible = useMemo(() => questions.filter((q) => isShown(q, answers)), [questions, answers]);
  const steps = Math.max(1, Math.ceil(visible.length / PER_STEP));
  const current = visible.slice(step * PER_STEP, step * PER_STEP + PER_STEP);
  const errors = { ...local, ...(state.fieldErrors ?? {}) };
  const last = step >= steps - 1;

  useEffect(() => {
    if (step > steps - 1) setStep(steps - 1);
  }, [step, steps]);
  useEffect(() => {
    // Jump back to the first step with a server-side error.
    const bad = Object.keys(state.fieldErrors ?? {})[0];
    if (bad) {
      const idx = visible.findIndex((q) => q.id === bad);
      if (idx >= 0) setStep(Math.floor(idx / PER_STEP));
    }
  }, [state, visible]);

  const set = (id: string, v: string) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setLocal((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  };

  const checkStep = (): boolean => {
    const e: Record<string, string> = {};
    for (const q of current) if (q.required && !(answers[q.id] ?? "").trim()) e[q.id] = "กรุณาตอบข้อนี้";
    setLocal(e);
    return Object.keys(e).length === 0;
  };

  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => headRef.current?.focus());
  };

  const submit = () => {
    if (!checkStep()) return;
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
    const shown = Object.fromEntries(visible.map((q) => [q.id, answers[q.id] ?? ""]));
    fd.set("answers", JSON.stringify(shown));
    startTransition(() => formAction(fd));
  };

  if (state.ok) {
    return (
      <div className="admin-card" role="status">
        <h2>ขอบคุณที่ตอบแบบสำรวจ</h2>
        <p>{state.ok}</p>
      </div>
    );
  }

  return (
    <div className="admin-card survey">
      <div className="survey-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / steps) * 100}%` }} />
      </div>
      <h2 ref={headRef} tabIndex={-1} className="small muted" style={{ fontWeight: 600 }}>
        ขั้นที่ {step + 1} จาก {steps}
      </h2>
      {state.error ? <p className="flash flash-error" role="alert">{state.error}</p> : null}

      {current.map((q) => {
        const id = `q-${q.id}`;
        const err = errors[q.id];
        const prefilled = initial[q.id] !== undefined && answers[q.id] === initial[q.id];
        return (
          <div key={q.id} className={`field${err ? " has-error" : ""}`}>
            {q.type === "single" || q.type === "scale" ? (
              <fieldset className="survey-choices" aria-describedby={err ? `${id}-e` : undefined}>
                <legend>
                  {q.label}
                  {q.required ? <span className="required" aria-hidden="true"> *</span> : null}
                </legend>
                {(q.type === "single" ? q.options ?? [] : Array.from({ length: (q.max ?? 5) - (q.min ?? 1) + 1 }, (_, i) => String((q.min ?? 1) + i))).map((o) => (
                  <label key={o} className={`choice${answers[q.id] === o ? " is-on" : ""}`}>
                    <input type="radio" name={q.id} value={o} checked={answers[q.id] === o} onChange={() => set(q.id, o)} />
                    <span>{o}</span>
                  </label>
                ))}
                {q.type === "scale" ? <p className="field-hint">1 = น้อยที่สุด · {q.max ?? 5} = มากที่สุด</p> : null}
              </fieldset>
            ) : (
              <>
                <label htmlFor={id}>
                  {q.label}
                  {q.required ? <span className="required" aria-hidden="true"> *</span> : null}
                </label>
                {q.type === "textarea" ? (
                  <textarea id={id} rows={4} maxLength={3000} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} />
                ) : (
                  <input id={id} maxLength={300} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} />
                )}
              </>
            )}
            {prefilled ? <p className="field-hint">เติมจากโปรไฟล์ของคุณ แก้ไขได้</p> : null}
            {err ? <p className="field-error" id={`${id}-e`}>{err}</p> : null}
          </div>
        );
      })}

      <div className="form-actions-inline">
        {step > 0 ? <button type="button" className="btn btn-outline" onClick={() => go(step - 1)}>← ย้อนกลับ</button> : null}
        {last ? (
          <button type="button" className="btn btn-primary" onClick={submit} disabled={pending} aria-busy={pending}>
            {pending ? "กำลังส่ง…" : "ส่งแบบสำรวจ"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => checkStep() && go(step + 1)}>ถัดไป →</button>
        )}
      </div>
    </div>
  );
}
