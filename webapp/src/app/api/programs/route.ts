import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Shape consumed by the registration form's programme picker. */
export interface ProgramOption {
  code: string;
  nameTh: string;
  nameEn: string | null;
  degreeLevel: string;
  studyPlan: string;
  status: "active" | "renamed" | "closed" | "planned";
  /** Present-day name when the row was renamed, e.g. "ช่างยนต์ → เทคนิคยานยนต์". */
  currentNameTh: string;
  verified: boolean;
}

interface Row {
  code: string;
  name_th: string;
  name_en: string | null;
  degree_level: string;
  study_plan: string;
  status: ProgramOption["status"];
  current_name_th: string;
  verified: boolean;
}

// Order the degree levels the way the faculty lists them, not alphabetically.
const LEVEL_ORDER = ["ปวส.", "อส.บ.", "ทล.บ.", "วศ.บ.", "สถ.บ.", "วศ.ม."];

/**
 * GET /api/programs — the full taxonomy grouped by degree level.
 *
 * Closed and renamed programmes are included on purpose: an alumnus who
 * finished ปวส. ช่างยนต์ in 2550 must be able to pick that name, not be forced
 * onto today's "เทคนิคยานยนต์".
 */
export async function GET() {
  try {
    const rows = await query<Row>(`
      SELECT code, name_th, name_en, degree_level::text, study_plan::text,
             status::text, current_name_th, verified
      FROM program_resolved
      WHERE status <> 'planned'
      ORDER BY sort_order, name_th
    `);

    const grouped: Record<string, ProgramOption[]> = {};
    for (const r of rows) {
      const opt: ProgramOption = {
        code: r.code,
        nameTh: r.name_th,
        nameEn: r.name_en,
        degreeLevel: r.degree_level,
        studyPlan: r.study_plan,
        status: r.status,
        currentNameTh: r.current_name_th,
        verified: r.verified,
      };
      (grouped[r.degree_level] ??= []).push(opt);
    }

    const levels = Object.keys(grouped).sort(
      (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
    );

    return NextResponse.json({
      levels: levels.map((level) => ({ level, programs: grouped[level] })),
    });
  } catch (err) {
    console.error("[api/programs]", err);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดรายการสาขาวิชาได้" },
      { status: 503 },
    );
  }
}
