"use client";

import { useMemo, useState } from "react";
import type { Alumni, FacetGroup, FacetKey } from "@/lib/types";
import { currentJob, fullName, programName } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import PersonCard from "./PersonCard";

type Selected = Record<FacetKey, string[]>;

const EMPTY: Selected = { cohort: [], program: [], province: [], jobCategory: [] };

/**
 * FR-DIR-01/02/03 — free-text search combined with multi-dimension facets.
 * Visual Design §6 — result count plus filter chips that can be removed one
 * at a time; the label sits above the search field rather than inside it.
 *
 * The per-option counts in the facet panel are illustrative figures from the
 * sample dataset; in the real system they come from the search index.
 */
export default function DirectoryExplorer({
  people,
  facets,
  isAuthenticated = false,
}: {
  people: Alumni[];
  facets: FacetGroup[];
  isAuthenticated?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selected>(EMPTY);

  function toggle(key: FacetKey, value: string) {
    setSelected((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });
  }

  const activeCount =
    selected.cohort.length +
    selected.program.length +
    selected.province.length +
    selected.jobCategory.length;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    return people.filter((p) => {
      if (q) {
        const haystack = [
          fullName(p),
          p.studentCode,
          ...(p.formerNames ?? []),
          programName(p.programId),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (
        selected.cohort.length &&
        !selected.cohort.includes(String(p.admissionYear))
      ) {
        return false;
      }
      if (
        selected.program.length &&
        !selected.program.includes(programName(p.programId))
      ) {
        return false;
      }
      if (
        selected.province.length &&
        !selected.province.includes(p.contact.province ?? "")
      ) {
        return false;
      }
      if (selected.jobCategory.length) {
        const job = currentJob(p);
        if (!job || !selected.jobCategory.includes(job.jobCategory)) return false;
      }
      return true;
    });
  }, [people, query, selected]);

  return (
    <div className="directory">
      <aside className="facets" aria-label="ตัวกรองการค้นหา">
        {facets.map((group) => (
          <div className="facet" key={group.key}>
            <h3>{group.label}</h3>
            {group.options.map((opt) => (
              <label key={opt.value}>
                <input
                  type="checkbox"
                  checked={selected[group.key].includes(opt.value)}
                  onChange={() => toggle(group.key, opt.value)}
                />
                {opt.value}
                <span className="count">{formatNumber(opt.count)}</span>
              </label>
            ))}
          </div>
        ))}

        {activeCount > 0 ? (
          <button
            className="btn btn-outline btn-sm facet-reset"
            onClick={() => setSelected(EMPTY)}
          >
            ล้างตัวกรองทั้งหมด
          </button>
        ) : null}
      </aside>

      <div>
        <div className="search-row">
          <div className="field">
            <label htmlFor="dir-q">ค้นหาศิษย์เก่า</label>
            <input
              id="dir-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ชื่อ นามสกุล ชื่อเดิม หรือรหัสนักศึกษา"
            />
          </div>
        </div>

        {activeCount > 0 ? (
          <div className="active-filters">
            {(Object.keys(selected) as FacetKey[]).flatMap((key) =>
              selected[key].map((value) => (
                <button
                  key={`${key}-${value}`}
                  className="filter-chip"
                  onClick={() => toggle(key, value)}
                >
                  {value} <span aria-hidden="true">✕</span>
                  <span className="sr-only">นำตัวกรองออก</span>
                </button>
              )),
            )}
          </div>
        ) : null}

        <div className="result-bar">
          <p className="result-count">
            พบ <strong>{formatNumber(results.length)}</strong> รายการ
            {results.length !== people.length
              ? ` จากทั้งหมด ${formatNumber(people.length)} รายการ`
              : ""}
          </p>
        </div>

        {results.length > 0 ? (
          <div className="person-list">
            {results.map((p) => (
              <PersonCard key={p.id} person={p} isAuthenticated={isAuthenticated} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>
              <strong>ไม่พบศิษย์เก่าที่ตรงกับเงื่อนไข</strong>
            </p>
            <p style={{ marginBottom: 0 }}>
              ลองลดตัวกรอง หรือค้นด้วยชื่อเดิมก่อนเปลี่ยนชื่อ-นามสกุล
            </p>
          </div>
        )}

        <div className="privacy-note">
          <p>
            <strong>ความเป็นส่วนตัว:</strong> ระเบียนที่ศิษย์เก่ายังไม่ได้ยืนยันตัวตนจะไม่ปรากฏในผลการค้นหา
            ข้อมูลติดต่อแสดงเฉพาะผู้ที่เข้าสู่ระบบแล้ว
            และระบบบันทึกประวัติการเข้าดูโปรไฟล์ไว้ตรวจสอบได้
          </p>
        </div>
      </div>
    </div>
  );
}
