"use client";

import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { REPORT_REASONS } from "@/lib/moderation";
import type { FormState } from "@/lib/form-state";

/** FR-ANEWS-11/17 — collapsed "report" control under a post or comment. */
export default function ReportForm({
  action,
  targetType,
  targetId,
  label = "รายงานเนื้อหาไม่เหมาะสม",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  targetType: "post" | "comment" | "job" | "kb";
  targetId: number;
  label?: string;
}) {
  return (
    <details className="report-box">
      <summary>{label}</summary>
      <ActionForm action={action} submitLabel="ส่งรายงาน" pendingLabel="กำลังส่ง…" className="" submitClassName="btn btn-outline btn-sm">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <Field as="select" name="reason" label="เหตุผล" options={REPORT_REASONS} emptyLabel="— เลือก —" required />
        <Field as="textarea" name="detail" label="รายละเอียดเพิ่มเติม (ไม่บังคับ)" rows={2} maxLength={500} />
      </ActionForm>
    </details>
  );
}
