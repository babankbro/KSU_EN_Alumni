/**
 * Membership registration — form shape and validation.
 *
 * Implements the data captured by FR-AUTH-01 (claim an imported record),
 * FR-AUTH-02 (self-registration when no record exists) and FR-AUTH-05
 * (recorded PDPA consent), with the per-field privacy control from
 * FR-PROF-03 and the former-name history from DR-01 / FR-PROF-07.
 *
 * Kept free of React so the rules can be unit-tested on their own.
 */
import type { DegreeLevel, Visibility } from "./types";

export type RegistrationPath = "claim" | "new";

/** A previous name, kept so classmates can still find the person (DR-01). */
export interface FormerName {
  id: string;
  firstNameTh: string;
  lastNameTh: string;
}

/**
 * A picked profile photo. `previewUrl` is an object URL created in the browser;
 * nothing is uploaded in this draft, so the caller must revoke it on removal
 * to avoid leaking the blob.
 */
export interface PhotoState {
  /** The picked File, kept so it can be uploaded on submit. */
  file: File;
  fileName: string;
  sizeBytes: number;
  type: string;
  previewUrl: string;
}

/** FR-PROF-10 — accepted formats and ceiling for the profile photo. */
export const PHOTO_ACCEPT = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_ACCEPT_LABEL = "JPG, PNG หรือ WebP";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates a dropped or picked file. Returns an error message in Thai, or
 * null when the file is acceptable.
 */
export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_ACCEPT.includes(file.type)) {
    return `รองรับเฉพาะไฟล์ ${PHOTO_ACCEPT_LABEL} (ไฟล์ที่เลือกเป็น ${file.type || "ไม่ทราบชนิด"})`;
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return `ไฟล์ใหญ่เกินไป (${formatBytes(file.size)}) ขนาดสูงสุดคือ ${formatBytes(PHOTO_MAX_BYTES)}`;
  }
  if (file.size === 0) {
    return "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์ใหม่";
  }
  return null;
}

export interface RegistrationForm {
  path: RegistrationPath;

  /* --- ขั้นที่ 1: ยืนยันตัวตน --- */
  studentCode: string;
  /** FR-AUTH-01 — one corroborating field, chosen by the applicant. */
  verifyMethod: "birthdate" | "idLast4";
  birthDate: string;
  /**
   * Only the last four digits are ever collected: the full national ID is not
   * needed to match a record, and storing it would breach NFR-PDPA-04
   * (data minimisation).
   */
  idLast4: string;

  /* --- ขั้นที่ 2: ชื่อและการศึกษา --- */
  /** FR-PROF-10 — profile photo, held as an object URL while drafting. */
  photo: PhotoState | null;
  titleTh: string;
  /** Free text, used only when titleTh === "อื่น ๆ" (ranks, clergy, Dr., …). */
  titleThOther: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  /** Thai alumni networks run on nicknames — people remember them. */
  nickname: string;
  formerNames: FormerName[];

  admissionYear: string;
  graduationYear: string;
  degreeLevel: DegreeLevel;
  programId: string;

  /* --- ขั้นที่ 3: ติดต่อและความเป็นส่วนตัว --- */
  email: string;
  phone: string;
  lineId: string;
  province: string;
  /** FR-PROF-03 — the applicant decides who may see each contact field. */
  visibility: Visibility;

  /* --- ขั้นที่ 4: ความยินยอม --- */
  consentData: boolean;
  consentDirectory: boolean;
  consentNews: boolean;
}

export const TITLE_OPTIONS = ["นาย", "นาง", "นางสาว", "อื่น ๆ"] as const;

export const DEGREE_OPTIONS: DegreeLevel[] = ["ปวส.", "ป.ตรี", "ป.โท"];

export const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  hint: string;
}[] = [
  {
    value: "public",
    label: "สาธารณะ",
    hint: "ผู้เข้าชมทั่วไปเห็นข้อมูลติดต่อของคุณได้",
  },
  {
    value: "members",
    label: "เฉพาะสมาชิก",
    hint: "เฉพาะศิษย์เก่าที่ยืนยันตัวตนแล้วจึงเห็นข้อมูลติดต่อ (แนะนำ)",
  },
  {
    value: "private",
    label: "ไม่เปิดเผย",
    hint: "ไม่แสดงข้อมูลติดต่อกับใครเลย ใช้เพื่อการติดต่อจากคณะเท่านั้น",
  },
];

export function emptyForm(): RegistrationForm {
  return {
    path: "claim",
    photo: null,
    studentCode: "",
    verifyMethod: "birthdate",
    birthDate: "",
    idLast4: "",
    titleTh: "นาย",
    titleThOther: "",
    firstNameTh: "",
    lastNameTh: "",
    firstNameEn: "",
    lastNameEn: "",
    nickname: "",
    formerNames: [],
    admissionYear: "",
    graduationYear: "",
    degreeLevel: "ป.ตรี",
    programId: "",
    email: "",
    phone: "",
    lineId: "",
    province: "",
    visibility: "members",
    consentData: false,
    consentDirectory: false,
    consentNews: false,
  };
}

export type Errors = Partial<Record<string, string>>;

/* ---------- field-level rules ---------- */

const THAI_LETTERS = /^[฀-๿\s.'’-]+$/;
const LATIN_LETTERS = /^[A-Za-z\s.'’-]+$/;
const DIGITS_ONLY = /^\d+$/;

/** Buddhist-era year, loosely bounded so typos surface early. */
function isPlausibleBeYear(value: string): boolean {
  if (!DIGITS_ONLY.test(value)) return false;
  const year = Number(value);
  return year >= 2500 && year <= 2600;
}

export function validateStep1(form: RegistrationForm): Errors {
  const e: Errors = {};

  if (form.path === "claim") {
    if (!form.studentCode.trim()) {
      e.studentCode = "กรุณากรอกรหัสนักศึกษา";
    } else if (!DIGITS_ONLY.test(form.studentCode.trim())) {
      e.studentCode = "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น";
    } else if (form.studentCode.trim().length < 9 || form.studentCode.trim().length > 12) {
      e.studentCode = "รหัสนักศึกษาต้องมี 9–12 หลัก";
    }

    if (form.verifyMethod === "birthdate") {
      if (!form.birthDate) {
        e.birthDate = "กรุณาระบุวันเดือนปีเกิดเพื่อยืนยันตัวตน";
      }
    } else if (!DIGITS_ONLY.test(form.idLast4) || form.idLast4.length !== 4) {
      e.idLast4 = "กรุณากรอกเลขบัตรประชาชน 4 หลักท้าย";
    }
  }

  return e;
}

export function validateStep2(form: RegistrationForm): Errors {
  const e: Errors = {};

  if (form.titleTh === "อื่น ๆ" && !form.titleThOther.trim()) {
    e.titleThOther = "กรุณาระบุคำนำหน้า";
  }

  if (!form.firstNameTh.trim()) {
    e.firstNameTh = "กรุณากรอกชื่อภาษาไทย";
  } else if (!THAI_LETTERS.test(form.firstNameTh.trim())) {
    e.firstNameTh = "ช่องนี้รับเฉพาะอักษรไทย";
  }

  if (!form.lastNameTh.trim()) {
    e.lastNameTh = "กรุณากรอกนามสกุลภาษาไทย";
  } else if (!THAI_LETTERS.test(form.lastNameTh.trim())) {
    e.lastNameTh = "ช่องนี้รับเฉพาะอักษรไทย";
  }

  // English names are optional, but if given they must be in Latin script —
  // they are what ends up on certificates and international correspondence.
  if (form.firstNameEn.trim() && !LATIN_LETTERS.test(form.firstNameEn.trim())) {
    e.firstNameEn = "ช่องนี้รับเฉพาะอักษรภาษาอังกฤษ";
  }
  if (form.lastNameEn.trim() && !LATIN_LETTERS.test(form.lastNameEn.trim())) {
    e.lastNameEn = "ช่องนี้รับเฉพาะอักษรภาษาอังกฤษ";
  }

  form.formerNames.forEach((n, i) => {
    const hasFirst = n.firstNameTh.trim().length > 0;
    const hasLast = n.lastNameTh.trim().length > 0;
    // A half-filled row is almost always an accident, so flag it rather than
    // silently dropping it on submit.
    if (hasFirst !== hasLast) {
      e[`formerName-${i}`] = "กรุณากรอกทั้งชื่อเดิมและนามสกุลเดิม หรือลบรายการนี้ออก";
    } else if (hasFirst && !THAI_LETTERS.test(n.firstNameTh.trim())) {
      e[`formerName-${i}`] = "ชื่อเดิมรับเฉพาะอักษรไทย";
    } else if (hasLast && !THAI_LETTERS.test(n.lastNameTh.trim())) {
      e[`formerName-${i}`] = "นามสกุลเดิมรับเฉพาะอักษรไทย";
    }
  });

  if (!isPlausibleBeYear(form.admissionYear)) {
    e.admissionYear = "กรุณากรอกปีที่เข้าศึกษาเป็น พ.ศ. เช่น 2560";
  }
  if (!isPlausibleBeYear(form.graduationYear)) {
    e.graduationYear = "กรุณากรอกปีที่สำเร็จการศึกษาเป็น พ.ศ. เช่น 2564";
  }
  if (
    isPlausibleBeYear(form.admissionYear) &&
    isPlausibleBeYear(form.graduationYear) &&
    Number(form.graduationYear) < Number(form.admissionYear)
  ) {
    e.graduationYear = "ปีที่สำเร็จการศึกษาต้องไม่น้อยกว่าปีที่เข้าศึกษา";
  }

  if (!form.programId) {
    e.programId = "กรุณาเลือกสาขาวิชา";
  }

  return e;
}

export function validateStep3(form: RegistrationForm): Errors {
  const e: Errors = {};

  const email = form.email.trim();
  if (!email) {
    e.email = "กรุณากรอกอีเมล เพื่อใช้ติดต่อและกู้คืนบัญชี";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    e.email = "รูปแบบอีเมลไม่ถูกต้อง";
  }

  const phone = form.phone.replace(/[\s-]/g, "");
  if (phone && (!DIGITS_ONLY.test(phone) || phone.length < 9 || phone.length > 10)) {
    e.phone = "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก";
  }

  return e;
}

export function validateStep4(form: RegistrationForm): Errors {
  const e: Errors = {};

  // FR-AUTH-05 — the registration cannot complete without recorded consent.
  if (!form.consentData) {
    e.consentData = "ต้องยินยอมให้จัดเก็บและใช้ข้อมูลจึงจะสมัครสมาชิกได้";
  }

  return e;
}

export const STEP_VALIDATORS = [
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
];

export function validateStep(index: number, form: RegistrationForm): Errors {
  const validator = STEP_VALIDATORS[index];
  return validator ? validator(form) : {};
}

/** Display name assembled the way it will appear in the directory. */
export function previewName(form: RegistrationForm): string {
  const title = form.titleTh === "อื่น ๆ" ? form.titleThOther.trim() : form.titleTh;
  const name = `${form.firstNameTh.trim()} ${form.lastNameTh.trim()}`.trim();
  const nickname = form.nickname.trim();
  return [title + name, nickname ? `(${nickname})` : ""].join(" ").trim();
}
