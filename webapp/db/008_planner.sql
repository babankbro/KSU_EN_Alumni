-- ============================================================
-- 008 — planner settings for a web workload (NFR-PERF-01/03)
--
-- On a small database the tables were never analysed, so PostgreSQL guessed
-- the directory view would touch hundreds of thousands of rows and switched
-- on JIT compilation for every page query: ~450 ms of compiling per query,
-- 1.3 s for the home page, while the query itself ran in under 15 ms.
-- This app runs many short queries; JIT never pays off here.
--
-- Idempotent:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni < db/008_planner.sql
-- ============================================================
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET jit = off', current_database());
  -- Statement logging is off: logged parameters would contain personal data.
  EXECUTE format('ALTER DATABASE %I RESET log_min_duration_statement', current_database());
END $$;

ANALYZE;
