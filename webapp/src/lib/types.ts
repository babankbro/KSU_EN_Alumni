/**
 * Domain types — mirrors 03-Design/Data Model.md
 *
 * Field-level notes reference the requirement they satisfy so the mapping
 * from SRS to code stays traceable (SRS ภาคผนวก ก).
 */

/** Data Model — `program` */
export interface Program {
  id: string;
  nameTh: string;
  nameEn: string;
  degreeLevel: DegreeLevel;
}

export type DegreeLevel = "ปวส." | "ป.ตรี" | "ป.โท";

/** FR-AUTH-01 / FR-DIR-07 — unclaimed records never surface publicly */
export type ClaimStatus = "unclaimed" | "pending" | "verified";

/** FR-PROF-03 — per-field privacy */
export type Visibility = "public" | "members" | "private";

/** Data Model — `contact` (split from `alumni` to keep privacy controls local) */
export interface Contact {
  email?: string;
  phone?: string;
  lineId?: string;
  province?: string;
  country?: string;
  visibility: Visibility;
}

/** Data Model — `employment`, kept as a time series for FR-SVY-07 */
export interface Employment {
  organization: string;
  position: string;
  jobCategory: string;
  sector: "รัฐ" | "เอกชน" | "ประกอบกิจการเอง" | "รัฐวิสาหกิจ";
  /** DR-02 / FR-SVY-08 — stored as a band, never an exact figure */
  salaryBand?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  /** used by the QA report — ตรงสาขาที่จบหรือไม่ */
  isRelatedToMajor: boolean;
}

/** Data Model — `alumni` */
export interface Alumni {
  id: string;
  studentCode: string;
  titleTh: string;
  firstNameTh: string;
  lastNameTh: string;
  /** DR-01 / FR-PROF-07 — so classmates can still find them after a name change */
  formerNames?: string[];
  admissionYear: number;
  graduationYear: number;
  degreeLevel: DegreeLevel;
  programId: string;
  claimStatus: ClaimStatus;
  /** FR-PROF-04 — drives the freshness badge */
  profileUpdatedAt: string;
  /** FR-PROF-05 */
  completenessScore: number;
  contact: Contact;
  employment: Employment[];
  skills: string[];
  /** Prototype/approved portrait shown in public cards. */
  imageSrc?: string;
  isNotable?: boolean;
  notableCitation?: string;
}

/** FR-ANEWS-02 — the alumni-submitted news categories */
export type AlumniNewsType =
  | "ความก้าวหน้าในอาชีพ"
  | "รางวัล/ความสำเร็จ"
  | "ธุรกิจ/ผลงานใหม่"
  | "กิจกรรมรุ่น"
  | "ประชาสัมพันธ์ทั่วไป"
  | "ข่าวไว้อาลัย";

/** FR-ANEWS-08/09 — moderation states */
export type ModerationStatus = "pending" | "approved" | "changes_requested" | "rejected";

/** FR-ANEWS-06 */
export type PostVisibility = "public" | "members" | "cohort";

/** Data Model — alumni-authored post */
export interface AlumniPost {
  id: string;
  authorId: string;
  type: AlumniNewsType;
  title: string;
  body: string;
  /** FR-ANEWS-03/04 — tagged alumni ids */
  taggedAlumniIds?: string[];
  visibility: PostVisibility;
  moderationStatus: ModerationStatus;
  /** FR-ANEWS-13 — memorial posts are always moderated, never auto-published */
  alwaysModerated?: boolean;
  publishedAt: string;
  congratsCount: number;
  commentCount: number;
  isPinned?: boolean;
}

/** Data Model — `news` (official, admin-authored) */
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  publishedAt: string;
  href: string;
}

/** Data Model — `event` */
export interface AlumniEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  isOnline?: boolean;
  registrationOpen: boolean;
  /** Prototype/approved event cover image. */
  imageSrc?: string;
}

/** FR-DIR-02/03 — a facet group and its counts */
export interface FacetGroup {
  key: FacetKey;
  label: string;
  options: FacetOption[];
}

export type FacetKey = "cohort" | "program" | "province" | "jobCategory";

export interface FacetOption {
  value: string;
  count: number;
}

/** Data Model — `job_post` (Visual Design §5.9) */
export interface JobPost {
  id: string;
  title: string;
  organization: string;
  /** งานประจำ / ฝึกงาน / สหกิจศึกษา */
  employmentType: "งานประจำ" | "ฝึกงาน" | "สหกิจศึกษา";
  location: string;
  closesAt: string;
  /** FR-JOB-01 — posted by an alumnus rather than by staff */
  postedByAlumniId?: string;
  requiredSkills: string[];
}
