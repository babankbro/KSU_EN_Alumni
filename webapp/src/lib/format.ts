/**
 * Date helpers.
 *
 * Dates in the mock data are Buddhist-era strings ("2569-09-12"), which is how
 * they are entered and displayed in Thai administrative systems.
 *
 * A fixed reference date is used instead of `Date.now()` so the server and the
 * client render the same markup — a live clock would cause hydration mismatches
 * on the freshness badges.
 */

/** Reference "today" for the draft: 23 ก.ย. 2569 (2026-09-23 CE). */
export const TODAY_BE = "2569-09-23";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

interface BeParts {
  year: number;
  month: number;
  day: number;
}

/** Parses "2569-09-12" or "2569-09-12T17:00" into its Buddhist-era parts. */
export function parseBe(value: string): BeParts {
  const [datePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map((n) => parseInt(n, 10));
  return { year: y, month: m, day: d ?? 1 };
}

/** "2569-09-12" → "12 ก.ย. 2569" */
export function formatThaiDate(value: string): string {
  const { year, month, day } = parseBe(value);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year}`;
}

/** "2569-11-14T17:00" → "17:00" */
export function formatTime(value: string): string {
  const [, timePart] = value.split("T");
  return timePart ?? "";
}

/** Whole months between a Buddhist-era date and the reference date. */
export function monthsSince(value: string, reference: string = TODAY_BE): number {
  const a = parseBe(value);
  const b = parseBe(reference);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/**
 * FR-PROF-04 / [[Engagement Strategy]] — a profile untouched for more than a
 * year is shown as potentially out of date rather than silently trusted.
 */
export function isStale(updatedAt: string): boolean {
  return monthsSince(updatedAt) > 12;
}

/** Relative wording for the news feed, derived from the same fixed reference. */
export function relativeThai(value: string): string {
  const a = parseBe(value);
  const b = parseBe(TODAY_BE);
  const days =
    (b.year - a.year) * 365 + (b.month - a.month) * 30 + (b.day - a.day);

  if (days <= 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันที่แล้ว`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ที่แล้ว`;
  if (days < 365) return `${Math.floor(days / 30)} เดือนที่แล้ว`;
  return formatThaiDate(value);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
