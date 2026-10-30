import "server-only";
import { query } from "./db";
import { fileUrl } from "./files";

/** Outstanding-alumni awards (FR-AWD-01 … 04). */

export interface Round {
  id: number;
  title: string;
  description: string | null;
  opensAt: Date;
  closesAt: Date;
  isOpen: boolean;
}

export async function openRound(): Promise<Round | null> {
  const [r] = await query<{ id: number; title: string; description: string | null; opens_at: Date; closes_at: Date }>(
    `SELECT id, title, description, opens_at, closes_at FROM award_round
     WHERE now() BETWEEN opens_at AND closes_at ORDER BY closes_at LIMIT 1`,
  );
  return r ? { id: r.id, title: r.title, description: r.description, opensAt: r.opens_at, closesAt: r.closes_at, isOpen: true } : null;
}

export interface Awardee {
  name: string;
  alumniId: string | null;
  listed: boolean;
  citation: string;
  round: string | null;
  cohort: number | null;
  program: string | null;
  photoUrl: string | null;
}

/**
 * FR-AWD-04 — everyone awarded through a round, plus records flagged notable
 * by staff before the system existed. A person awarded twice appears per award.
 */
export async function listAwardees(): Promise<Awardee[]> {
  const rows = await query<{
    name: string; alumni_id: string | null; listed: boolean; citation: string; round: string | null;
    cohort: number | null; program: string | null; photo_file_id: string | null; photo_public: boolean;
  }>(
    `SELECT coalesce(a.title_th || a.first_name_th || ' ' || a.last_name_th, n.nominee_name) AS name, a.id AS alumni_id,
            d.id IS NOT NULL AS listed, coalesce(n.citation, '') AS citation, r.title AS round,
            a.admission_year AS cohort, pr.current_name_th AS program, d.photo_file_id,
            coalesce(d.field_visibility->>'photo', d.visibility::text) = 'public' AS photo_public, r.closes_at AS sort_at
     FROM award_nomination n JOIN award_round r ON r.id = n.round_id
     LEFT JOIN alumni a ON a.id = n.nominee_alumni_id AND a.anonymized_at IS NULL
     LEFT JOIN program_resolved pr ON pr.id = a.program_id
     LEFT JOIN directory_public d ON d.id = a.id
     WHERE n.status = 'awarded'
     UNION ALL
     SELECT a.title_th || a.first_name_th || ' ' || a.last_name_th, a.id, d.id IS NOT NULL, coalesce(a.notable_citation, ''), NULL,
            a.admission_year, pr.current_name_th, d.photo_file_id,
            coalesce(d.field_visibility->>'photo', d.visibility::text) = 'public', NULL
     FROM alumni a JOIN program_resolved pr ON pr.id = a.program_id
     LEFT JOIN directory_public d ON d.id = a.id
     WHERE a.is_notable AND a.anonymized_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM award_nomination n WHERE n.nominee_alumni_id = a.id AND n.status = 'awarded')
     ORDER BY sort_at DESC NULLS LAST, name`,
  );
  return rows.map((r) => ({
    name: r.name, alumniId: r.alumni_id, listed: r.listed, citation: r.citation, round: r.round, cohort: r.cohort,
    program: r.program,
    // Public page: only photos their owners made public.
    photoUrl: r.photo_file_id && r.photo_public ? fileUrl(r.photo_file_id) : null,
  }));
}
