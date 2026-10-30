"use client";

import { useRef, useState } from "react";
import { PROGRAMS } from "@/lib/data";
import {
  DEGREE_OPTIONS,
  TITLE_OPTIONS,
  VISIBILITY_OPTIONS,
  emptyForm,
  previewName,
  validateStep,
  type Errors,
  type RegistrationForm as FormState,
  type RegistrationPath,
} from "@/lib/registration";
import type { DegreeLevel, Visibility } from "@/lib/types";
import PhotoDropzone from "./PhotoDropzone";

const STEPS = [
  { title: "ยืนยันตัวตน", hint: "ตรวจสอบว่าคุณมีระเบียนอยู่ในระบบแล้วหรือไม่" },
  { title: "ชื่อและการศึกษา", hint: "ชื่อที่จะแสดงในทำเนียบศิษย์เก่า" },
  { title: "ติดต่อและความเป็นส่วนตัว", hint: "คุณเลือกได้ว่าใครเห็นข้อมูลติดต่อ" },
  { title: "ยินยอมและตรวจสอบ", hint: "อ่านและยืนยันก่อนส่งใบสมัคร" },
];

export default function RegistrationForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the message for the field being corrected, so the form stops
    // scolding the user while they are fixing it.
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function goNext() {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Move focus to the summary so screen-reader users hear what failed.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return <SubmittedPanel form={form} />;
  }

  const errorList = Object.entries(errors);

  return (
    <div className="register-layout">
      <ol className="stepper" aria-label="ขั้นตอนการสมัคร">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className={
              i === step ? "is-current" : i < step ? "is-done" : undefined
            }
            aria-current={i === step ? "step" : undefined}
          >
            <span className="step-num" aria-hidden="true">
              {i < step ? "✓" : i + 1}
            </span>
            <span className="step-text">
              <strong>{s.title}</strong>
              <span>{s.hint}</span>
            </span>
          </li>
        ))}
      </ol>

      <form
        className="register-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step === STEPS.length - 1) submit();
          else goNext();
        }}
      >
        {errorList.length > 0 ? (
          <div
            className="error-summary"
            role="alert"
            tabIndex={-1}
            ref={summaryRef}
          >
            <strong>กรุณาตรวจสอบ {errorList.length} รายการต่อไปนี้</strong>
            <ul>
              {errorList.map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 0 ? <StepIdentity form={form} set={set} errors={errors} /> : null}
        {step === 1 ? <StepName form={form} set={set} errors={errors} /> : null}
        {step === 2 ? <StepContact form={form} set={set} errors={errors} /> : null}
        {step === 3 ? <StepConsent form={form} set={set} errors={errors} /> : null}

        <div className="form-actions">
          {step > 0 ? (
            <button type="button" className="btn btn-outline" onClick={goBack}>
              ย้อนกลับ
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary">
            {step === STEPS.length - 1 ? "ส่งใบสมัคร" : "ถัดไป"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================= shared field helpers ================= */

function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`field${error ? " has-error" : ""}`}>
      {/* §6 — the label always sits above the control, never inside it */}
      <label htmlFor={id}>
        {label}
        {required ? (
          <span className="required" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          <span className="optional"> (ไม่บังคับ)</span>
        )}
      </label>
      {children({
        id,
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SetFn = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

interface StepProps {
  form: FormState;
  set: SetFn;
  errors: Errors;
}

/* ================= step 1 — identity ================= */

function StepIdentity({ form, set, errors }: StepProps) {
  return (
    <fieldset className="form-section">
      <legend>ขั้นที่ 1 — ยืนยันตัวตน</legend>

      <div className="choice-cards" role="radiogroup" aria-label="รูปแบบการสมัคร">
        {(
          [
            {
              value: "claim",
              title: "ฉันเป็นศิษย์เก่าที่มีรหัสนักศึกษา",
              body: "ระบบจะค้นระเบียนที่นำเข้าจากงานทะเบียน แล้วให้คุณตรวจสอบและแก้ไขข้อมูลเดิมได้ทันที — เร็วกว่าและข้อมูลครบกว่า",
            },
            {
              value: "new",
              title: "ไม่พบรหัสนักศึกษา / จบก่อนมีระบบทะเบียน",
              body: "กรอกข้อมูลเองทั้งหมด ใบสมัครจะเข้าคิวให้เจ้าหน้าที่ตรวจสอบก่อนอนุมัติ",
            },
          ] as { value: RegistrationPath; title: string; body: string }[]
        ).map((opt) => (
          <label
            key={opt.value}
            className={`choice-card${form.path === opt.value ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name="path"
              value={opt.value}
              checked={form.path === opt.value}
              onChange={() => set("path", opt.value)}
            />
            <span>
              <strong>{opt.title}</strong>
              <span className="choice-body">{opt.body}</span>
            </span>
          </label>
        ))}
      </div>

      {form.path === "claim" ? (
        <>
          <Field
            id="studentCode"
            label="รหัสนักศึกษา"
            required
            error={errors.studentCode}
            hint="ตัวเลข 9–12 หลัก ตามที่ปรากฏบนบัตรนักศึกษาหรือใบรายงานผลการศึกษา"
          >
            {(p) => (
              <input
                {...p}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.studentCode}
                onChange={(e) => set("studentCode", e.target.value)}
              />
            )}
          </Field>

          <div className="field">
            <span className="field-label">ยืนยันตัวตนด้วย</span>
            <div className="radio-row">
              <label>
                <input
                  type="radio"
                  name="verifyMethod"
                  checked={form.verifyMethod === "birthdate"}
                  onChange={() => set("verifyMethod", "birthdate")}
                />
                วันเดือนปีเกิด
              </label>
              <label>
                <input
                  type="radio"
                  name="verifyMethod"
                  checked={form.verifyMethod === "idLast4"}
                  onChange={() => set("verifyMethod", "idLast4")}
                />
                เลขบัตรประชาชน 4 หลักท้าย
              </label>
            </div>
          </div>

          {form.verifyMethod === "birthdate" ? (
            <Field
              id="birthDate"
              label="วันเดือนปีเกิด"
              required
              error={errors.birthDate}
            >
              {(p) => (
                <input
                  {...p}
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                />
              )}
            </Field>
          ) : (
            <Field
              id="idLast4"
              label="เลขบัตรประชาชน 4 หลักท้าย"
              required
              error={errors.idLast4}
              hint="ระบบเก็บเฉพาะ 4 หลักท้ายเพื่อใช้จับคู่ระเบียนเท่านั้น ไม่เก็บเลขบัตรเต็ม"
            >
              {(p) => (
                <input
                  {...p}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={form.idLast4}
                  onChange={(e) => set("idLast4", e.target.value)}
                />
              )}
            </Field>
          )}
        </>
      ) : (
        <p className="info-note">
          คุณเลือกกรอกข้อมูลเอง ขั้นถัดไปจะให้กรอกชื่อและข้อมูลการศึกษาทั้งหมด
          เจ้าหน้าที่งานศิษย์เก่าสัมพันธ์จะตรวจสอบก่อนอนุมัติ
          โดยทั่วไปใช้เวลาไม่เกิน 3 วันทำการ
        </p>
      )}
    </fieldset>
  );
}

/* ================= step 2 — name ================= */

function StepName({ form, set, errors }: StepProps) {
  function addFormerName() {
    set("formerNames", [
      ...form.formerNames,
      { id: `fn-${Date.now()}`, firstNameTh: "", lastNameTh: "" },
    ]);
  }

  function updateFormerName(id: string, patch: Partial<{ firstNameTh: string; lastNameTh: string }>) {
    set(
      "formerNames",
      form.formerNames.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  }

  function removeFormerName(id: string) {
    set(
      "formerNames",
      form.formerNames.filter((n) => n.id !== id),
    );
  }

  return (
    <fieldset className="form-section">
      <legend>ขั้นที่ 2 — ชื่อและข้อมูลการศึกษา</legend>

      <PhotoDropzone photo={form.photo} onChange={(next) => set("photo", next)} />

      <h3 className="form-subhead">ชื่อภาษาไทย</h3>
      <div className="field-grid">
        <Field id="titleTh" label="คำนำหน้า" required>
          {(p) => (
            <select
              {...p}
              value={form.titleTh}
              onChange={(e) => set("titleTh", e.target.value)}
            >
              {TITLE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Field>

        {form.titleTh === "อื่น ๆ" ? (
          <Field
            id="titleThOther"
            label="ระบุคำนำหน้า"
            required
            error={errors.titleThOther}
            hint="เช่น ยศทางทหาร/ตำรวจ หรือ ดร."
          >
            {(p) => (
              <input
                {...p}
                type="text"
                value={form.titleThOther}
                onChange={(e) => set("titleThOther", e.target.value)}
              />
            )}
          </Field>
        ) : null}

        <Field id="firstNameTh" label="ชื่อ" required error={errors.firstNameTh}>
          {(p) => (
            <input
              {...p}
              type="text"
              autoComplete="given-name"
              value={form.firstNameTh}
              onChange={(e) => set("firstNameTh", e.target.value)}
            />
          )}
        </Field>

        <Field id="lastNameTh" label="นามสกุล" required error={errors.lastNameTh}>
          {(p) => (
            <input
              {...p}
              type="text"
              autoComplete="family-name"
              value={form.lastNameTh}
              onChange={(e) => set("lastNameTh", e.target.value)}
            />
          )}
        </Field>

        <Field
          id="nickname"
          label="ชื่อเล่น"
          hint="ช่วยให้เพื่อนร่วมรุ่นค้นหาคุณเจอง่ายขึ้นมาก"
        >
          {(p) => (
            <input
              {...p}
              type="text"
              value={form.nickname}
              onChange={(e) => set("nickname", e.target.value)}
            />
          )}
        </Field>
      </div>

      <h3 className="form-subhead">ชื่อภาษาอังกฤษ</h3>
      <div className="field-grid">
        <Field id="firstNameEn" label="First name" error={errors.firstNameEn}>
          {(p) => (
            <input
              {...p}
              type="text"
              value={form.firstNameEn}
              onChange={(e) => set("firstNameEn", e.target.value)}
            />
          )}
        </Field>
        <Field id="lastNameEn" label="Last name" error={errors.lastNameEn}>
          {(p) => (
            <input
              {...p}
              type="text"
              value={form.lastNameEn}
              onChange={(e) => set("lastNameEn", e.target.value)}
            />
          )}
        </Field>
      </div>

      <h3 className="form-subhead">ชื่อ-นามสกุลเดิม</h3>
      <p className="field-hint">
        ถ้าคุณเคยเปลี่ยนชื่อหรือนามสกุล กรอกชื่อเดิมไว้ด้วย
        เพื่อให้เพื่อนร่วมรุ่นที่จำชื่อเดิมได้ยังค้นหาคุณเจอ
      </p>

      {form.formerNames.map((n, i) => (
        <div className="former-name-row" key={n.id}>
          <Field id={`formerFirst-${n.id}`} label="ชื่อเดิม">
            {(p) => (
              <input
                {...p}
                type="text"
                value={n.firstNameTh}
                onChange={(e) => updateFormerName(n.id, { firstNameTh: e.target.value })}
              />
            )}
          </Field>
          <Field id={`formerLast-${n.id}`} label="นามสกุลเดิม">
            {(p) => (
              <input
                {...p}
                type="text"
                value={n.lastNameTh}
                onChange={(e) => updateFormerName(n.id, { lastNameTh: e.target.value })}
              />
            )}
          </Field>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => removeFormerName(n.id)}
          >
            ลบ
            <span className="sr-only"> ชื่อเดิมรายการที่ {i + 1}</span>
          </button>
          {errors[`formerName-${i}`] ? (
            <p className="field-error row-error">{errors[`formerName-${i}`]}</p>
          ) : null}
        </div>
      ))}

      <button type="button" className="btn btn-outline btn-sm" onClick={addFormerName}>
        + เพิ่มชื่อเดิม
      </button>

      <h3 className="form-subhead">ข้อมูลการศึกษา</h3>
      <div className="field-grid">
        <Field
          id="admissionYear"
          label="ปีที่เข้าศึกษา (พ.ศ.)"
          required
          error={errors.admissionYear}
          hint="ใช้จัดกลุ่มรุ่นในทำเนียบศิษย์เก่า"
        >
          {(p) => (
            <input
              {...p}
              type="text"
              inputMode="numeric"
              placeholder="2560"
              value={form.admissionYear}
              onChange={(e) => set("admissionYear", e.target.value)}
            />
          )}
        </Field>

        <Field
          id="graduationYear"
          label="ปีที่สำเร็จการศึกษา (พ.ศ.)"
          required
          error={errors.graduationYear}
        >
          {(p) => (
            <input
              {...p}
              type="text"
              inputMode="numeric"
              placeholder="2564"
              value={form.graduationYear}
              onChange={(e) => set("graduationYear", e.target.value)}
            />
          )}
        </Field>

        <Field id="degreeLevel" label="ระดับการศึกษา" required>
          {(p) => (
            <select
              {...p}
              value={form.degreeLevel}
              onChange={(e) => set("degreeLevel", e.target.value as DegreeLevel)}
            >
              {DEGREE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field id="programId" label="สาขาวิชา" required error={errors.programId}>
          {(p) => (
            <select
              {...p}
              value={form.programId}
              onChange={(e) => set("programId", e.target.value)}
            >
              <option value="">— เลือกสาขาวิชา —</option>
              {PROGRAMS.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.nameTh}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {form.firstNameTh.trim() || form.lastNameTh.trim() ? (
        <p className="name-preview">
          ชื่อที่จะแสดงในทำเนียบ: <strong>{previewName(form)}</strong>
        </p>
      ) : null}
    </fieldset>
  );
}

/* ================= step 3 — contact ================= */

function StepContact({ form, set, errors }: StepProps) {
  return (
    <fieldset className="form-section">
      <legend>ขั้นที่ 3 — ข้อมูลติดต่อและความเป็นส่วนตัว</legend>

      <div className="field-grid">
        <Field
          id="email"
          label="อีเมล"
          required
          error={errors.email}
          hint="ใช้สำหรับยืนยันการสมัครและกู้คืนบัญชี"
        >
          {(p) => (
            <input
              {...p}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          )}
        </Field>

        <Field id="phone" label="เบอร์โทรศัพท์" error={errors.phone}>
          {(p) => (
            <input
              {...p}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          )}
        </Field>

        <Field id="lineId" label="LINE ID">
          {(p) => (
            <input
              {...p}
              type="text"
              value={form.lineId}
              onChange={(e) => set("lineId", e.target.value)}
            />
          )}
        </Field>

        <Field id="province" label="จังหวัดที่อยู่ปัจจุบัน">
          {(p) => (
            <input
              {...p}
              type="text"
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            />
          )}
        </Field>
      </div>

      <h3 className="form-subhead">ใครเห็นข้อมูลติดต่อของคุณได้บ้าง</h3>
      <div className="choice-cards" role="radiogroup" aria-label="ระดับความเป็นส่วนตัว">
        {VISIBILITY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`choice-card${form.visibility === opt.value ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name="visibility"
              value={opt.value}
              checked={form.visibility === opt.value}
              onChange={() => set("visibility", opt.value as Visibility)}
            />
            <span>
              <strong>{opt.label}</strong>
              <span className="choice-body">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <p className="info-note">
        คุณเปลี่ยนการตั้งค่านี้ได้ตลอดเวลาจากหน้าโปรไฟล์
        และตั้งค่าแยกรายฟิลด์ได้หลังจากยืนยันตัวตนแล้ว
      </p>
    </fieldset>
  );
}

/* ================= step 4 — consent ================= */

function StepConsent({ form, set, errors }: StepProps) {
  const program = PROGRAMS.find((p) => p.id === form.programId);

  return (
    <fieldset className="form-section">
      <legend>ขั้นที่ 4 — ความยินยอมและตรวจสอบข้อมูล</legend>

      <div className="review-card">
        <h3>ข้อมูลที่จะส่ง</h3>
        <dl className="review-list">
          <div>
            <dt>ชื่อ</dt>
            <dd>{previewName(form) || "—"}</dd>
          </div>
          {form.firstNameEn.trim() || form.lastNameEn.trim() ? (
            <div>
              <dt>ชื่ออังกฤษ</dt>
              <dd>
                {form.firstNameEn} {form.lastNameEn}
              </dd>
            </div>
          ) : null}
          {form.formerNames.filter((n) => n.firstNameTh.trim()).length > 0 ? (
            <div>
              <dt>ชื่อเดิม</dt>
              <dd>
                {form.formerNames
                  .filter((n) => n.firstNameTh.trim())
                  .map((n) => `${n.firstNameTh} ${n.lastNameTh}`)
                  .join(", ")}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>รุ่น / สาขา</dt>
            <dd>
              {form.admissionYear || "—"} · {program?.nameTh ?? "—"} ({form.degreeLevel})
            </dd>
          </div>
          <div>
            <dt>อีเมล</dt>
            <dd>{form.email || "—"}</dd>
          </div>
          <div>
            <dt>รูปโปรไฟล์</dt>
            <dd>{form.photo ? form.photo.fileName : "ไม่ได้แนบ"}</dd>
          </div>
          <div>
            <dt>ความเป็นส่วนตัว</dt>
            <dd>
              {VISIBILITY_OPTIONS.find((v) => v.value === form.visibility)?.label}
            </dd>
          </div>
        </dl>
      </div>

      <h3 className="form-subhead">ความยินยอมตาม PDPA</h3>

      <div className={`consent-item${errors.consentData ? " has-error" : ""}`}>
        <label>
          <input
            type="checkbox"
            checked={form.consentData}
            onChange={(e) => set("consentData", e.target.checked)}
            aria-invalid={errors.consentData ? true : undefined}
            aria-describedby={errors.consentData ? "consentData-error" : undefined}
          />
          <span>
            <strong>
              ยินยอมให้จัดเก็บและใช้ข้อมูล <span className="required">*</span>
            </strong>
            <span className="choice-body">
              ข้าพเจ้ายินยอมให้คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์
              จัดเก็บและใช้ข้อมูลข้างต้นเพื่อการติดต่อ การจัดกิจกรรมศิษย์เก่า
              และการรายงานประกันคุณภาพการศึกษา
            </span>
          </span>
        </label>
        {errors.consentData ? (
          <p className="field-error" id="consentData-error">
            {errors.consentData}
          </p>
        ) : null}
      </div>

      <div className="consent-item">
        <label>
          <input
            type="checkbox"
            checked={form.consentDirectory}
            onChange={(e) => set("consentDirectory", e.target.checked)}
          />
          <span>
            <strong>ยินยอมให้แสดงชื่อในทำเนียบศิษย์เก่า</strong>
            <span className="choice-body">
              หากไม่ยินยอม ระเบียนของคุณจะไม่ปรากฏในผลการค้นหา
              แต่ยังใช้สมัครสมาชิกและรับข่าวสารได้ตามปกติ
            </span>
          </span>
        </label>
      </div>

      <div className="consent-item">
        <label>
          <input
            type="checkbox"
            checked={form.consentNews}
            onChange={(e) => set("consentNews", e.target.checked)}
          />
          <span>
            <strong>ยินยอมรับข่าวสารและกิจกรรม</strong>
            <span className="choice-body">
              รับข่าวผ่านอีเมลหรือ LINE ยกเลิกได้ทุกเมื่อ
            </span>
          </span>
        </label>
      </div>

      <p className="info-note">
        คุณมีสิทธิขอสำเนาข้อมูล แก้ไขให้ถูกต้อง ถอนความยินยอม
        หรือขอให้ลบข้อมูลออกจากระบบได้ทุกเมื่อ
        โดยติดต่องานศิษย์เก่าสัมพันธ์ คณะวิศวกรรมศาสตร์
      </p>
    </fieldset>
  );
}

/* ================= submitted ================= */

function SubmittedPanel({ form }: { form: FormState }) {
  const claiming = form.path === "claim";

  return (
    <div className="submitted-panel" role="status">
      <span className="submitted-icon" aria-hidden="true">
        ✓
      </span>
      <h2>ส่งใบสมัครเรียบร้อย</h2>
      <p>
        ขอบคุณ {previewName(form)}{" "}
        {claiming
          ? "ระบบกำลังจับคู่ข้อมูลกับระเบียนในงานทะเบียน หากตรงกันคุณจะได้รับอีเมลยืนยันภายใน 1 วันทำการ"
          : "ใบสมัครของคุณเข้าคิวรอเจ้าหน้าที่ตรวจสอบ โดยทั่วไปใช้เวลาไม่เกิน 3 วันทำการ"}
      </p>
      <p className="info-note">
        หน้านี้เป็นเว็บไซต์ร่าง ข้อมูลที่กรอก<strong>ไม่ได้ถูกส่งหรือจัดเก็บที่ใด</strong>{" "}
        และรูปที่แนบอยู่ในเบราว์เซอร์ของคุณเท่านั้น
      </p>
    </div>
  );
}
