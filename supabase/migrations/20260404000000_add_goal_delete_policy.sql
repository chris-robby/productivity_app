-- Allow users to permanently delete their own goals.
-- Child rows (roadmap_phases, daily_tasks, task_failures, progress_snapshots)
-- are removed automatically via ON DELETE CASCADE defined in the initial schema.

DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;

CREATE POLICY "Users can delete their own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);
