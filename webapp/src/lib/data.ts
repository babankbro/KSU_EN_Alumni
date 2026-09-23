/**
 * Mock data for the draft application.
 *
 * ⚠️ ข้อมูลทั้งหมดเป็นตัวอย่างสมมติ ไม่ใช่ข้อมูลบุคคลจริง
 * ในระบบจริงข้อมูลชุดนี้มาจากการนำเข้าจากทะเบียน/CONGRATE (FR-ADM-01)
 * แล้วศิษย์เก่า claim โปรไฟล์ของตนเอง (FR-AUTH-01)
 */
import type {
  Alumni,
  AlumniEvent,
  AlumniPost,
  FacetGroup,
  JobPost,
  NewsItem,
  Program,
} from "./types";

export const PROGRAMS: Program[] = [
  { id: "cpe", nameTh: "วิศวกรรมคอมพิวเตอร์", nameEn: "Computer Engineering", degreeLevel: "ป.ตรี" },
  { id: "me", nameTh: "วิศวกรรมเครื่องกล", nameEn: "Mechanical Engineering", degreeLevel: "ป.ตรี" },
  { id: "ee", nameTh: "วิศวกรรมไฟฟ้า", nameEn: "Electrical Engineering", degreeLevel: "ป.ตรี" },
  { id: "lge", nameTh: "วิศวกรรมโลจิสติกส์", nameEn: "Logistics Engineering", degreeLevel: "ป.ตรี" },
  { id: "ie", nameTh: "วิศวกรรมอุตสาหการ", nameEn: "Industrial Engineering", degreeLevel: "ป.ตรี" },
  { id: "ce", nameTh: "วิศวกรรมโยธา", nameEn: "Civil Engineering", degreeLevel: "ป.ตรี" },
];

export function programName(id: string): string {
  return PROGRAMS.find((p) => p.id === id)?.nameTh ?? id;
}

/** FR-DIR-05 — headline figures shown on the landing page */
/**
 * Visual Design §5.4 — four figures: alumni, cohorts, programmes, and profiles
 * refreshed within 12 months (the last one makes data decay visible).
 *
 * The spec forbids showing example numbers as though they were real, so these
 * are computed from the sample records that ship with the draft and the strip
 * states that they come from sample data.
 */
export const SITE_STATS = [
  { key: "alumni", label: "ศิษย์เก่าในระบบ" },
  { key: "cohorts", label: "จำนวนรุ่น" },
  { key: "programs", label: "สาขาวิชา" },
  { key: "fresh", label: "โปรไฟล์ที่อัปเดตใน 12 เดือน" },
] as const;

export const ALUMNI: Alumni[] = [
  {
    id: "a1",
    studentCode: "60130100142",
    titleTh: "นาย",
    firstNameTh: "อนุชา",
    lastNameTh: "พรมมา",
    admissionYear: 2560,
    graduationYear: 2564,
    degreeLevel: "ป.ตรี",
    programId: "cpe",
    claimStatus: "verified",
    profileUpdatedAt: "2569-09-12",
    completenessScore: 92,
    contact: { province: "ขอนแก่น", country: "ไทย", visibility: "members" },
    employment: [
      {
        organization: "บริษัทเทคโนโลยีแห่งหนึ่ง",
        position: "Software Engineer",
        jobCategory: "ไอที/ซอฟต์แวร์",
        sector: "เอกชน",
        salaryBand: "30,001–40,000",
        startDate: "2564-06",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["TypeScript", "ระบบฝังตัว", "Cloud"],
  },
  {
    id: "a2",
    studentCode: "62130200087",
    titleTh: "นางสาว",
    firstNameTh: "วรรณา",
    lastNameTh: "ดีงาม",
    admissionYear: 2562,
    graduationYear: 2566,
    degreeLevel: "ป.ตรี",
    programId: "ee",
    claimStatus: "verified",
    profileUpdatedAt: "2569-08-03",
    completenessScore: 78,
    contact: { province: "กาฬสินธุ์", country: "ไทย", visibility: "members" },
    employment: [
      {
        organization: "การไฟฟ้าส่วนภูมิภาค",
        position: "วิศวกรควบคุมระบบ",
        jobCategory: "ราชการ/รัฐวิสาหกิจ",
        sector: "รัฐวิสาหกิจ",
        salaryBand: "20,001–30,000",
        startDate: "2566-08",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["ระบบไฟฟ้ากำลัง", "PLC"],
  },
  {
    id: "a3",
    studentCode: "57130300055",
    titleTh: "นาย",
    firstNameTh: "ธนพล",
    lastNameTh: "แก้วใส",
    admissionYear: 2557,
    graduationYear: 2561,
    degreeLevel: "ป.ตรี",
    programId: "me",
    claimStatus: "verified",
    /** เจตนาให้เก่ากว่า 12 เดือน เพื่อให้เห็น badge "ข้อมูลอาจไม่เป็นปัจจุบัน" */
    profileUpdatedAt: "2568-01-20",
    completenessScore: 54,
    contact: { province: "ระยอง", country: "ไทย", visibility: "private" },
    employment: [
      {
        organization: "โรงงานแปรรูปเกษตร",
        position: "หัวหน้าฝ่ายซ่อมบำรุง",
        jobCategory: "วิศวกร",
        sector: "เอกชน",
        salaryBand: "40,001–50,000",
        startDate: "2563-01",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["งานซ่อมบำรุง", "ความปลอดภัยในโรงงาน"],
  },
  {
    id: "a4",
    studentCode: "64130400211",
    titleTh: "นางสาว",
    firstNameTh: "ศิริพร",
    lastNameTh: "ภูผา",
    admissionYear: 2564,
    graduationYear: 2568,
    degreeLevel: "ป.ตรี",
    programId: "lge",
    claimStatus: "verified",
    profileUpdatedAt: "2569-08-28",
    completenessScore: 85,
    contact: { province: "กรุงเทพมหานคร", country: "ไทย", visibility: "members" },
    employment: [
      {
        organization: "บริษัทโลจิสติกส์",
        position: "นักวางแผนขนส่ง",
        jobCategory: "วิศวกร",
        sector: "เอกชน",
        salaryBand: "20,001–30,000",
        startDate: "2568-07",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["การวางแผนขนส่ง", "การวิเคราะห์ข้อมูล"],
  },
  {
    id: "a5",
    studentCode: "48130100003",
    titleTh: "นาย",
    firstNameTh: "สมชาย",
    lastNameTh: "ใจดี",
    admissionYear: 2548,
    graduationYear: 2552,
    degreeLevel: "ป.ตรี",
    programId: "cpe",
    claimStatus: "verified",
    profileUpdatedAt: "2569-07-02",
    completenessScore: 96,
    contact: { province: "กาฬสินธุ์", country: "ไทย", visibility: "members" },
    employment: [
      {
        organization: "บริษัทซอฟต์แวร์ในภาคอีสาน",
        position: "ผู้ก่อตั้งและกรรมการผู้จัดการ",
        jobCategory: "ประกอบกิจการเอง",
        sector: "ประกอบกิจการเอง",
        startDate: "2558-01",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["ระบบฝังตัว", "การบริหารโครงการ"],
    imageSrc: "/images/profile-somchai.png",
    isNotable: true,
    notableCitation:
      "ผู้ก่อตั้งบริษัทซอฟต์แวร์ในภาคอีสาน และวิทยากรรับเชิญด้านระบบฝังตัวให้กับคณะอย่างต่อเนื่อง",
  },
  {
    id: "a6",
    studentCode: "51130200019",
    titleTh: "นางสาว",
    firstNameTh: "สุดารัตน์",
    lastNameTh: "ทองมี",
    formerNames: ["สุดารัตน์ แสงทอง"],
    admissionYear: 2551,
    graduationYear: 2555,
    degreeLevel: "ป.ตรี",
    programId: "ee",
    claimStatus: "verified",
    profileUpdatedAt: "2569-09-05",
    completenessScore: 90,
    contact: { province: "ขอนแก่น", country: "ไทย", visibility: "members" },
    employment: [
      {
        organization: "โครงการพลังงานหมุนเวียน",
        position: "วิศวกรระบบไฟฟ้าอาวุโส",
        jobCategory: "วิศวกร",
        sector: "เอกชน",
        startDate: "2560-03",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["พลังงานหมุนเวียน", "ระบบไฟฟ้ากำลัง"],
    imageSrc: "/images/profile-nalin.png",
    isNotable: true,
    notableCitation:
      "วิศวกรระบบไฟฟ้าโครงการพลังงานหมุนเวียน ผู้ริเริ่มทุนการศึกษาสำหรับรุ่นน้องในสาขา",
  },
  {
    id: "a7",
    studentCode: "53130300077",
    titleTh: "นาย",
    firstNameTh: "ประเสริฐ",
    lastNameTh: "มั่นคง",
    admissionYear: 2553,
    graduationYear: 2557,
    degreeLevel: "ป.ตรี",
    programId: "me",
    claimStatus: "verified",
    profileUpdatedAt: "2569-06-18",
    completenessScore: 88,
    contact: { province: "ระยอง", country: "ไทย", visibility: "members" },
    employment: [
      {
        organization: "โรงงานอุตสาหกรรมเกษตร",
        position: "ผู้จัดการโรงงาน",
        jobCategory: "วิศวกร",
        sector: "เอกชน",
        startDate: "2562-05",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["การบริหารการผลิต", "สหกิจศึกษา"],
    imageSrc: "/images/profile-kittipong.png",
    isNotable: true,
    notableCitation:
      "ผู้จัดการโรงงานอุตสาหกรรมเกษตร และผู้รับนักศึกษาสหกิจศึกษาของคณะต่อเนื่อง 8 ปี",
  },
  {
    id: "a8",
    studentCode: "58130400123",
    titleTh: "นางสาว",
    firstNameTh: "กนกวรรณ",
    lastNameTh: "ศรีสุข",
    admissionYear: 2558,
    graduationYear: 2562,
    degreeLevel: "ป.ตรี",
    programId: "lge",
    claimStatus: "verified",
    profileUpdatedAt: "2569-09-19",
    completenessScore: 94,
    contact: { province: "กรุงเทพมหานคร", country: "ไทย", visibility: "members" },
    employment: [
      {
        organization: "บริษัทขนส่งระหว่างประเทศ",
        position: "ผู้เชี่ยวชาญการวางแผนขนส่ง",
        jobCategory: "วิศวกร",
        sector: "เอกชน",
        startDate: "2565-02",
        isCurrent: true,
        isRelatedToMajor: true,
      },
    ],
    skills: ["การวางแผนขนส่ง", "พี่เลี้ยงอาชีพ"],
    imageSrc: "/images/profile-pimchanok.png",
    isNotable: true,
    notableCitation:
      "ผู้เชี่ยวชาญด้านการวางแผนขนส่ง และผู้ก่อตั้งกลุ่มพี่เลี้ยงอาชีพสำหรับศิษย์เก่ารุ่นใหม่",
  },
];

/** FR-DIR-02/03 — facet groups with counts */
export const FACETS: FacetGroup[] = [
  {
    key: "cohort",
    label: "รุ่น (ปีที่เข้าศึกษา)",
    options: [
      { value: "2566", count: 128 },
      { value: "2565", count: 141 },
      { value: "2564", count: 136 },
      { value: "2563", count: 119 },
      { value: "2562", count: 124 },
      { value: "2560", count: 111 },
      { value: "2558", count: 98 },
      { value: "2557", count: 94 },
      { value: "2553", count: 81 },
      { value: "2551", count: 76 },
      { value: "2548", count: 63 },
    ],
  },
  {
    key: "program",
    label: "สาขาวิชา",
    options: [
      { value: "วิศวกรรมคอมพิวเตอร์", count: 642 },
      { value: "วิศวกรรมเครื่องกล", count: 518 },
      { value: "วิศวกรรมไฟฟ้า", count: 487 },
      { value: "วิศวกรรมโลจิสติกส์", count: 396 },
      { value: "วิศวกรรมอุตสาหการ", count: 452 },
      { value: "วิศวกรรมโยธา", count: 352 },
    ],
  },
  {
    key: "province",
    label: "จังหวัด",
    options: [
      { value: "กาฬสินธุ์", count: 712 },
      { value: "ขอนแก่น", count: 458 },
      { value: "กรุงเทพมหานคร", count: 391 },
      { value: "ระยอง", count: 204 },
      { value: "ชลบุรี", count: 186 },
      { value: "มหาสารคาม", count: 142 },
    ],
  },
  {
    key: "jobCategory",
    label: "กลุ่มอาชีพ",
    options: [
      { value: "วิศวกร", count: 1124 },
      { value: "ไอที/ซอฟต์แวร์", count: 486 },
      { value: "ราชการ/รัฐวิสาหกิจ", count: 352 },
      { value: "ประกอบกิจการเอง", count: 218 },
      { value: "การศึกษา/วิจัย", count: 97 },
    ],
  },
];

/** FR-ANEWS-14 — the alumni news feed */
export const ALUMNI_POSTS: AlumniPost[] = [
  {
    id: "p1",
    authorId: "a1",
    type: "ความก้าวหน้าในอาชีพ",
    title: "ได้รับตำแหน่งหัวหน้าทีมพัฒนาระบบ",
    body: "ขอบคุณพื้นฐานจากคณะที่ทำให้ผมมาถึงวันนี้ครับ ใครสนใจงานสายซอฟต์แวร์ที่ขอนแก่น ทักมาได้เลย ทีมกำลังเปิดรับรุ่นน้องอยู่พอดี",
    visibility: "public",
    moderationStatus: "approved",
    publishedAt: "2569-09-21",
    congratsCount: 42,
    commentCount: 8,
  },
  {
    id: "p2",
    authorId: "a6",
    type: "รางวัล/ความสำเร็จ",
    title: "ได้รับรางวัลวิศวกรดีเด่นระดับภูมิภาค ประจำปี 2569",
    body: "ขอมอบรางวัลนี้ให้คณาจารย์ทุกท่านที่สอนมาค่ะ และขอเชิญรุ่นน้องที่สนใจงานด้านพลังงานหมุนเวียนเข้าร่วมกิจกรรมแนะแนวอาชีพเดือนหน้า",
    visibility: "public",
    moderationStatus: "approved",
    publishedAt: "2569-09-18",
    congratsCount: 118,
    commentCount: 23,
    isPinned: true,
  },
  {
    id: "p3",
    authorId: "a7",
    type: "กิจกรรมรุ่น",
    title: "นัดรวมรุ่น 2555 ครบรอบ 14 ปี",
    body: "เปิดรับลงชื่อเข้าร่วมแล้ว พร้อมเปิดจองเสื้อรุ่นรอบแรก รายละเอียดเวลาและสถานที่อยู่ในหน้ากิจกรรม ใครติดต่อเพื่อนในรุ่นไม่ได้ ลองค้นในทำเนียบศิษย์เก่าได้เลย",
    taggedAlumniIds: ["a3"],
    visibility: "members",
    moderationStatus: "approved",
    publishedAt: "2569-09-15",
    congratsCount: 67,
    commentCount: 31,
  },
  {
    id: "p4",
    authorId: "a5",
    type: "ธุรกิจ/ผลงานใหม่",
    title: "เปิดรับนักศึกษาสหกิจศึกษา 12 อัตรา",
    body: "บริษัทเปิดรับรุ่นน้องเข้าฝึกสหกิจในสายพัฒนาระบบและระบบฝังตัว มีค่าตอบแทนและที่พัก ติดต่อผ่านงานสหกิจศึกษาของคณะได้เลยครับ",
    visibility: "public",
    moderationStatus: "approved",
    publishedAt: "2569-09-10",
    congratsCount: 55,
    commentCount: 12,
  },
  {
    id: "p5",
    authorId: "a8",
    type: "ความก้าวหน้าในอาชีพ",
    title: "เริ่มต้นโครงการพี่เลี้ยงอาชีพสำหรับศิษย์เก่ารุ่นใหม่",
    body: "เปิดรับรุ่นน้องที่จบไม่เกิน 3 ปี เข้าร่วมกลุ่มพี่เลี้ยง ช่วยดูเรซูเม่และเตรียมสัมภาษณ์ ไม่มีค่าใช้จ่าย",
    visibility: "members",
    moderationStatus: "approved",
    publishedAt: "2569-09-02",
    congratsCount: 73,
    commentCount: 19,
  },
];

export const NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "เปิดรับสมัครทุนการศึกษาจากศิษย์เก่า ประจำปี 2570",
    summary: "สำหรับนักศึกษาชั้นปีที่ 2–4 ที่มีผลการเรียนดีและขาดแคลนทุนทรัพย์ จำนวน 20 ทุน",
    category: "ทุนการศึกษา",
    publishedAt: "2569-09-18",
    href: "#",
  },
  {
    id: "n2",
    title: "ขอเชิญเสนอชื่อศิษย์เก่าดีเด่น ประจำปี 2570",
    summary: "เปิดรับการเสนอชื่อจากศิษย์เก่าทุกรุ่น ถึงวันที่ 31 ตุลาคม 2569",
    category: "ศิษย์เก่าดีเด่น",
    publishedAt: "2569-09-02",
    href: "#",
  },
  {
    id: "n3",
    title: "ขอความร่วมมือศิษย์เก่าตอบแบบสำรวจภาวะการมีงานทำ",
    summary:
      "ข้อมูลของท่านจะถูกใช้เพื่อการปรับปรุงหลักสูตรและรายงานประกันคุณภาพ ใช้เวลาประมาณ 5 นาที",
    category: "แบบสำรวจ",
    publishedAt: "2569-08-25",
    href: "#",
  },
  {
    id: "n4",
    title: "ประกาศผลการคัดเลือกศิษย์เก่าดีเด่น ประจำปี 2569",
    summary: "คณะกรรมการได้พิจารณาคัดเลือกศิษย์เก่าดีเด่น 4 ท่าน จากผู้ได้รับการเสนอชื่อ 27 ท่าน",
    category: "ศิษย์เก่าดีเด่น",
    publishedAt: "2569-08-11",
    href: "#",
  },
  {
    id: "n5",
    title: "เปิดใช้งานระบบยืนยันตัวตนศิษย์เก่าผ่าน LINE",
    summary: "ศิษย์เก่าสามารถยืนยันตัวตนและรับบัตรศิษย์เก่าดิจิทัลได้ผ่าน LINE Official Account",
    category: "ระบบสารสนเทศ",
    publishedAt: "2569-07-30",
    href: "#",
  },
  {
    id: "n6",
    title: "สรุปผลภาวะการมีงานทำของบัณฑิต ปีการศึกษา 2568",
    summary: "บัณฑิตได้งานทำภายใน 1 ปี คิดเป็นร้อยละ 87 โดยร้อยละ 79 ทำงานตรงสาขาที่สำเร็จการศึกษา",
    category: "ประกันคุณภาพ",
    publishedAt: "2569-07-14",
    href: "#",
  },
];

export const EVENTS: AlumniEvent[] = [
  {
    id: "e1",
    title: "คืนสู่เหย้า ชาววิศวฯ กาฬสินธุ์ 2569",
    startsAt: "2569-11-14T17:00",
    endsAt: "2569-11-14T22:00",
    venue: "ลานกิจกรรมคณะวิศวกรรมศาสตร์",
    registrationOpen: true,
    imageSrc: "/images/event-homecoming.png",
  },
  {
    id: "e2",
    title: "เปิดบ้านอาชีพ: เส้นทางวิศวกรรุ่นพี่",
    startsAt: "2569-11-28T09:00",
    endsAt: "2569-11-28T12:00",
    venue: "ห้องประชุมคณะวิศวกรรมศาสตร์",
    registrationOpen: true,
    imageSrc: "/images/event-connect.png",
  },
  {
    id: "e3",
    title: "Job Fair ศิษย์เก่าพบรุ่นน้อง",
    startsAt: "2569-12-09T09:30",
    endsAt: "2569-12-09T16:00",
    venue: "อาคารเรียนรวม มหาวิทยาลัยกาฬสินธุ์",
    registrationOpen: true,
    imageSrc: "/images/event-robotics.png",
  },
  {
    id: "e4",
    title: "อบรมทักษะ AI สำหรับวิศวกร (ศิษย์เก่าเรียนฟรี)",
    startsAt: "2570-01-23T13:00",
    endsAt: "2570-01-23T16:00",
    venue: "ออนไลน์ผ่านระบบประชุมทางไกล",
    isOnline: true,
    registrationOpen: false,
  },
];

export function alumniById(id: string): Alumni | undefined {
  return ALUMNI.find((a) => a.id === id);
}

export function fullName(a: Alumni): string {
  return `${a.titleTh}${a.firstNameTh} ${a.lastNameTh}`;
}

export function initials(a: Alumni): string {
  return a.firstNameTh.slice(0, 2);
}

export function currentJob(a: Alumni) {
  return a.employment.find((e) => e.isCurrent);
}

/** Visual Design §5.9 — jobs and internships shared by alumni */
export const JOB_POSTS: JobPost[] = [
  {
    id: "j1",
    title: "Software Engineer (Backend)",
    organization: "บริษัทเทคโนโลยีแห่งหนึ่ง",
    employmentType: "งานประจำ",
    location: "ขอนแก่น",
    closesAt: "2569-11-30",
    postedByAlumniId: "a1",
    requiredSkills: ["TypeScript", "ฐานข้อมูล"],
  },
  {
    id: "j2",
    title: "นักศึกษาสหกิจศึกษา — ระบบฝังตัว",
    organization: "บริษัทซอฟต์แวร์ในภาคอีสาน",
    employmentType: "สหกิจศึกษา",
    location: "กาฬสินธุ์",
    closesAt: "2569-10-31",
    postedByAlumniId: "a5",
    requiredSkills: ["ระบบฝังตัว", "C"],
  },
  {
    id: "j3",
    title: "ผู้ช่วยวิศวกรวางแผนขนส่ง (ฝึกงาน)",
    organization: "บริษัทขนส่งระหว่างประเทศ",
    employmentType: "ฝึกงาน",
    location: "กรุงเทพมหานคร",
    closesAt: "2569-12-15",
    postedByAlumniId: "a8",
    requiredSkills: ["การวางแผนขนส่ง", "การวิเคราะห์ข้อมูล"],
  },
];
