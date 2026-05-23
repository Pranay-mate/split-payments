-- 0005 — add profiles.onboarded_at + backfill existing users.
--
-- Null = haven't completed (or skipped) the first-login welcome carousel
-- at /app/welcome. Non-null = passed through. Existing users get
-- backfilled to NOW() so a deploy doesn't dump every veteran into a
-- welcome flow they don't need.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Backfill: every existing profile is "already onboarded".
UPDATE public.profiles
  SET onboarded_at = COALESCE(onboarded_at, now())
  WHERE onboarded_at IS NULL;
