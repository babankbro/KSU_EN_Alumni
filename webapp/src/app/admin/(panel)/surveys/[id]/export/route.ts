import { audit, getAdminSession } from "@/lib/server/auth";
import { getSurvey, surveyReport } from "@/lib/server/surveys";
import { toCsv } from "@/lib/server/csv";

export const dynamic = "force-dynamic";

/**
 * GET /admin/surveys/:id/export — FR-SVY-06 aggregate report for QA documents:
 * one row per question option (count, percent, mean), then the employment
 * breakdowns. Never individual answers, so salary stays in bands (FR-SVY-08).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session || (session.role !== "admin" && session.role !== "faculty")) return new Response("Not found", { status: 404 });
  const id = Number((await ctx.params).id);
  const survey = Number.isInteger(id) ? await getSurvey(id) : null;
  if (!survey) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const f = {
    program: /^\d+$/.test(url.searchParams.get("program") ?? "") ? url.searchParams.get("program")! : "",
    gradYear: /^\d{4}$/.test(url.searchParams.get("grad") ?? "") ? url.searchParams.get("grad")! : "",
  };
  const report = await surveyReport(survey, f);
  const rows: Record<string, unknown>[] = [];
  for (const q of report.questions) {
    if (q.question.type === "text" || q.question.type === "textarea") {
      rows.push({ section: "คำถาม", item: q.question.label, option: "(คำตอบปลายเปิด)", n: q.answered, pct: "", mean: "" });
      continue;
    }
    if (q.suppressed || !q.counts) {
      rows.push({ section: "คำถาม", item: q.question.label, option: "ผู้ตอบน้อยเกินไป — ไม่แสดง", n: q.answered, pct: "", mean: "" });
      continue;
    }
    for (const c of q.counts) {
      rows.push({
        section: "คำถาม", item: q.question.label, option: c.option, n: c.n,
        pct: q.answered ? ((c.n / q.answered) * 100).toFixed(1) : "", mean: q.mean !== null ? q.mean.toFixed(2) : "",
      });
    }
  }
  for (const r of report.byProgram) rows.push({ section: "มีงานทำตามสาขา", item: r.program, option: "", n: r.n, pct: r.employed === null ? "n<5" : ((r.employed / r.n) * 100).toFixed(1), mean: "" });
  for (const r of report.byYears) rows.push({ section: "มีงานทำตามปีหลังจบ", item: `${r.years} ปี`, option: "", n: r.n, pct: r.employed === null ? "n<5" : ((r.employed / r.n) * 100).toFixed(1), mean: "" });

  await audit(session, "survey.export", "survey", id, f);
  const csv = toCsv([["หมวด", "section"], ["รายการ", "item"], ["ตัวเลือก", "option"], ["จำนวน", "n"], ["ร้อยละ", "pct"], ["ค่าเฉลี่ย", "mean"]], rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="survey-${id}-report.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
