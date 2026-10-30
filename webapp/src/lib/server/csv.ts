import "server-only";

/**
 * CSV for staff reports and exports. A UTF-8 BOM is prepended so Excel on
 * Windows opens Thai text correctly instead of showing mojibake.
 *
 * Cells that start with = + - @ are prefixed with an apostrophe: a name like
 * "=HYPERLINK(...)" typed into a registration form must not run as a formula
 * when staff open the export (CSV injection).
 */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: [header: string, key: string][], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(([h]) => cell(h)).join(",")];
  for (const r of rows) lines.push(columns.map(([, k]) => cell(r[k])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Minimal RFC 4180 parser for imports: quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}
