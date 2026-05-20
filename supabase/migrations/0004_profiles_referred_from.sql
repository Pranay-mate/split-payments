-- Track which `?from=<name>` invite URL a user signed up through.
-- Set once at first attachReferrer call; never overwritten. Powers the
-- Top Referrers tile in the admin panel.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_from text;
