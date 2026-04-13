/**
 * Migration service — moves a free user's SQLite data to Supabase
 * when they upgrade to premium.
 *
 * Call migrateLocalDataToSupabase() AFTER the user has a valid Supabase session.
 */
import { format } from 'date-fns';
import { supabase } from './supabase';
import {
  getAllGoalsLocal,
  getTasksForAnalyticsLocal,
  getFailureReasonsLocal,
} from './database/sqlite';
import { useTierStore } from '../store/tierStore';

export interface MigrationResult {
  goalsCreated: number;
  tasksCreated: number;
  errors: string[];
}

export async function migrateLocalDataToSupabase(): Promise<MigrationResult> {
  const result: MigrationResult = { goalsCreated: 0, tasksCreated: 0, errors: [] };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user — cannot migrate');

  const localGoals = getAllGoalsLocal();

  for (const localGoal of localGoals) {
    try {
      // 1. Insert goal
      const { data: remoteGoal, error: goalErr } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          goal_text: localGoal.goal_text,
          timeline_months: localGoal.timeline_months,
          target_date: localGoal.target_date,
          status: localGoal.status,
          created_at: localGoal.created_at,
          user_context: localGoal.user_context ?? null,
          initial_conversation: {},
          total_tasks: localGoal.total_tasks,
          completed_tasks: localGoal.completed_tasks,
          current_completion_rate: localGoal.current_completion_rate,
        })
        .select('id')
        .single();

      if (goalErr || !remoteGoal) {
        result.errors.push(`Goal "${localGoal.goal_text}": ${goalErr?.message}`);
        continue;
      }

      result.goalsCreated++;

      // 2. Insert daily_tasks for this goal
      const localTasks = getTasksForAnalyticsLocal(localGoal.id);

      const taskRows = localTasks.map((t) => ({
        goal_id: remoteGoal.id,
        task_title: t.task_title,
        task_description: t.task_description ?? null,
        scheduled_date: t.scheduled_date,
        estimated_minutes: t.estimated_minutes,
        priority: t.priority,
        completed: t.completed,
        completed_at: t.completed_at ?? null,
        failed: t.failed,
        failure_reason: t.failure_reason ?? null,
        created_at: t.created_at,
      }));

      if (taskRows.length > 0) {
        const { error: tasksErr } = await supabase.from('daily_tasks').insert(taskRows);
        if (tasksErr) {
          result.errors.push(`Tasks for goal "${localGoal.goal_text}": ${tasksErr.message}`);
        } else {
          result.tasksCreated += taskRows.length;
        }
      }
    } catch (err: any) {
      result.errors.push(`Unexpected error for goal "${localGoal.goal_text}": ${err.message}`);
    }
  }

  // 3. Flip tier to premium — always, even on partial migration errors.
  // The user authenticated successfully; blocking upgrade over a single failed goal
  // would leave them stuck. Errors are surfaced in the result for the caller to display.
  await useTierStore.getState().setTier('premium');

  return result;
}
