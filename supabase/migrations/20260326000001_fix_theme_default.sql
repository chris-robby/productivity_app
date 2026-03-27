-- Fix theme column: change default from 'auto' to 'dark' and update existing rows.
-- 'auto' was in the original schema but the app only supports 'light' | 'dark'.
-- Any row with theme = 'auto' gets treated as undefined colors, causing a broken UI.

ALTER TABLE user_settings
  ALTER COLUMN theme SET DEFAULT 'dark';

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_theme_check;

ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_theme_check
  CHECK (theme IN ('light', 'dark'));

-- Migrate any existing 'auto' rows to 'dark'
UPDATE user_settings SET theme = 'dark' WHERE theme = 'auto';
