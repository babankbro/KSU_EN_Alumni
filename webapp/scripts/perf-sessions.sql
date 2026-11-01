-- NFR-PERF-03 load test: signed-in members for the virtual users.
-- Gives the first N fake alumni from perf-seed.sql an account and a session
-- whose cookie value is "perf-<n>" — so each virtual user has its own
-- account and per-account rate limits apply as in real use.
-- Throwaway copy ONLY:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni_perf < scripts/perf-sessions.sql
\set n 500
BEGIN;
CREATE TEMP TABLE pick AS
  SELECT a.id, row_number() OVER (ORDER BY a.id) AS g
  FROM alumni a JOIN alumni_contact c ON c.alumni_id = a.id
  WHERE c.email LIKE 'perf%@example.invalid'
  LIMIT :n;
INSERT INTO account (email, role, alumni_id, display_name)
  SELECT 'perf' || g || '@session.invalid', 'alumni', id, 'perf ' || g FROM pick;
INSERT INTO account_session (token_hash, account_id, expires_at)
  SELECT encode(digest('perf-' || p.g, 'sha256'), 'hex'), ac.id, now() + interval '1 day'
  FROM pick p JOIN account ac ON ac.alumni_id = p.id;
SELECT 'sessions', count(*) FROM account_session;
COMMIT;
