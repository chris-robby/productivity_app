-- Add subscription_tier to user_settings so premium status is persisted server-side.
-- Free users never touch Supabase, so this only matters for premium/authenticated users.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium'));

COMMENT ON COLUMN user_settings.subscription_tier IS
  'Tracks whether the user has an active premium subscription. '
  'Set to premium after successful in-app purchase verification.';
