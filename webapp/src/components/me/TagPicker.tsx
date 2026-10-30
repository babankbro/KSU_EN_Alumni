"use client";

import { useEffect, useId, useState } from "react";
import { useFieldError } from "@/components/forms/ActionForm";

type Person = { id: string; name: string; cohort?: number; program?: string };

/**
 * FR-ANEWS-03 — pick alumni to tag. Each chosen person becomes a hidden
 * `tags` input, so the form posts normally. Search waits for a pause in
 * typing to keep lookups (which are rate limited) to a minimum.
 */
export default function TagPicker({
  initial,
  name = "tags",
  label = "แท็กศิษย์เก่าที่เกี่ยวข้อง (ไม่บังคับ)",
  hint = "ผู้ถูกแท็กจะได้รับแจ้งเมื่อข่าวเผยแพร่ และปฏิเสธการแท็กได้",
  max = 20,
}: {
  initial: Person[];
  name?: string;
  label?: string;
  hint?: string;
  max?: number;
}) {
  const id = useId();
  const error = useFieldError(name);
  const [chosen, setChosen] = useState<Person[]>(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setStatus("");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/alumni-lookup?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const data = (await r.json()) as { people: Person[]; error?: string };
        setResults(data.people);
        setStatus(data.error ?? (data.people.length ? `พบ ${data.people.length} คน` : "ไม่พบชื่อนี้ในทำเนียบ"));
      } catch {
        if (!ctrl.signal.aborted) setStatus("ค้นหาไม่สำเร็จ");
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const add = (p: Person) => {
    setChosen((c) => (c.some((x) => x.id === p.id) ? c : max === 1 ? [p] : c.length >= max ? c : [...c, p]));
    setQ("");
  };

  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {chosen.length ? (
        <ul className="tag-chips" aria-label="ผู้ที่ถูกแท็ก">
          {chosen.map((p) => (
            <li key={p.id}>
              <input type="hidden" name={name} value={p.id} />
              {p.name}
              <button type="button" onClick={() => setChosen((c) => c.filter((x) => x.id !== p.id))} aria-label={`นำ ${p.name} ออก`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่ออย่างน้อย 2 ตัวอักษร" autoComplete="off" />
      <p className="field-hint" aria-live="polite">{status || hint}</p>
      {results.length ? (
        <ul className="tag-results">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p)} disabled={chosen.some((x) => x.id === p.id)}>
                {p.name} <span className="muted small">รุ่น {p.cohort} · {p.program}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
