-- =====================================================================
-- 0002_disable_rls — disable Row Level Security on all public tables
-- =====================================================================
-- New Supabase projects enable RLS by default. EasySplits doesn't use
-- RLS — authorization lives in the tRPC routers (every protected
-- procedure checks ctx.user.id, every query filters by user_id), so
-- the data layer should just trust the application code.
--
-- Without this, any INSERT/UPDATE through DATABASE_URL gets silently
-- rejected by Postgres because no policies exist for our role.
-- =====================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;
