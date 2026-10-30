-- ============================================================
-- 006 — follow-ups found while building the remaining modules
--   alumni-post images (served per post visibility, not publicly)
--   moderation audit for comments · event cover purpose already exists
--
-- Idempotent:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni < db/006_posts_events_jobs.sql
-- ============================================================

-- A post image follows its post's visibility (FR-ANEWS-06), so it cannot
-- share the always-public news_image purpose.
ALTER TYPE file_purpose ADD VALUE IF NOT EXISTS 'post_image';

ALTER TABLE alumni_post_comment ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE alumni_post ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS alumni_post_author_idx ON alumni_post (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS alumni_post_tag_alumni_idx ON alumni_post_tag (alumni_id);

-- FR-JOB-03 filters by province; `location` stays free text (e.g. "นิคมฯ อมตะ").
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS province text;
UPDATE job_post SET province = location WHERE province IS NULL AND location IS NOT NULL;
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS moderated_by text;
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS job_post_live_idx ON job_post (moderation_status, closes_at);

ALTER TABLE kb_article ADD COLUMN IF NOT EXISTS moderated_by text;
CREATE INDEX IF NOT EXISTS kb_article_search_trgm_idx ON kb_article USING gin ((title || ' ' || coalesce(summary, '') || ' ' || body) gin_trgm_ops);

-- FR-EVT-01: events can be drafts until staff publish them.
ALTER TABLE event ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
