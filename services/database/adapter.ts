/**
 * Data adapter — routes all reads/writes to SQLite (free) or Supabase (premium)
 * based on the current tier stored in tierStore.
 *
 * Import from here everywhere instead of importing Supabase or SQLite directly.
 */
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { supabase } from '../supabase';
import { useTierStore } from '../../store/tierStore';
import {
  initSchema,
  clearAllDataLocal,
  getActiveGoalLocal,
  getAllGoalsLocal,
  getGoalByIdLocal,
  insertGoalLocal,
  updateGoalStatusLocal,
  updateGoalContextLocal,
  updateGoalProgressLocal,
  updateGoalTextLocal,
  deleteGoalLocal,
  insertHabitsLocal,
  generateDailyTasksLocal,
  getHabitsForGoalLocal,
  getUpcomingTaskTitlesLocal,
  deleteHabitLocal,
  deleteTasksByHabitLocal,
  updateHabitDaysLocal,
  insertTasksForHabitLocal,
  getTodaysTasksLocal,
  getTasksByDateRangeLocal,
  getTasksForAnalyticsLocal,
  getTasksForGoalsLocal,
  markTaskCompleteLocal,
  markTaskFailedLocal,
  getFailureReasonsLocal,
} from './sqlite';
import { Goal, DailyTask } from '../../types';

// ─── Init (call once on app boot) ─────────────────────────────────────────────
export function initLocalDb(): void {
  initSchema();
}

// ─── Clear all local data (free tier only) ────────────────────────────────────
export function clearAllLocalData(): void {
  clearAllDataLocal();
}

function isPremium(): boolean {
  return useTierStore.getState().tier === 'premium';
}

// ─── Goals ─────────────────────────────────────────────────────────────────────
export async function getActiveGoal(): Promise<Goal | null> {
  if (isPremium()) {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }
  return getActiveGoalLocal();
}

export async function getAllGoals(): Promise<Goal[]> {
  if (isPremium()) {
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false });
    return data ?? [];
  }
  return getAllGoalsLocal();
}

export async function saveGoalWithHabits(params: {
  goalText: string;
  timelineMonths: number;
  userContext?: string;
  tasks: Array<{ text: string; days: number[] }>;
}): Promise<void> {
  const { goalText, timelineMonths, userContext, tasks } = params;
  const targetDate = format(addDays(new Date(), timelineMonths * 30), 'yyyy-MM-dd');

  if (isPremium()) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        goal_text: goalText,
        timeline_months: timelineMonths,
        target_date: targetDate,
        status: 'active',
        initial_conversation: {},
        user_context: userContext || null,
      })
      .select()
      .single();

    if (goalErr || !goal) throw goalErr ?? new Error('Failed to save goal');

    await supabase.from('habits').insert(
      tasks.map((t) => ({
        goal_id: goal.id,
        user_id: user.id,
        habit_text: t.text.trim(),
        frequency: 'custom',
        frequency_days: t.days.length,
      }))
    );

    // Pre-generate 30 days of tasks
    const { addDays: add, eachDayOfInterval, format: fmt } = await import('date-fns');
    const start = new Date();
    const allDays = eachDayOfInterval({ start, end: add(start, 29) });
    const taskRows: object[] = [];
    for (const day of allDays) {
      const dow = day.getDay();
      for (const task of tasks) {
        if (task.days.includes(dow)) {
          taskRows.push({
            goal_id: goal.id,
            task_title: task.text.trim(),
            scheduled_date: fmt(day, 'yyyy-MM-dd'),
            estimated_minutes: 0,
            priority: 'medium',
            completed: false,
            failed: false,
          });
        }
      }
    }
    if (taskRows.length > 0) {
      await supabase.from('daily_tasks').insert(taskRows);
    }
  } else {
    const goal = insertGoalLocal({ goalText, timelineMonths, targetDate, userContext });
    insertHabitsLocal(goal.id, tasks);
    generateDailyTasksLocal(goal.id, tasks);
  }
}

export async function updateGoalStatus(
  goalId: string,
  status: 'active' | 'completed' | 'abandoned'
): Promise<void> {
  if (isPremium()) {
    await supabase.from('goals').update({ status }).eq('id', goalId);
  } else {
    updateGoalStatusLocal(goalId, status);
  }
}

export async function updateGoalContext(goalId: string, userContext: string): Promise<void> {
  if (isPremium()) {
    await supabase.from('goals').update({ user_context: userContext }).eq('id', goalId);
  } else {
    updateGoalContextLocal(goalId, userContext);
  }
}

export async function updateGoalProgress(goalId: string): Promise<void> {
  if (isPremium()) {
    const { data: allTasks } = await supabase
      .from('daily_tasks')
      .select('id, completed')
      .eq('goal_id', goalId);
    if (allTasks) {
      const total = allTasks.length;
      const done = allTasks.filter((t: { id: string; completed: boolean }) => t.completed).length;
      await supabase.from('goals').update({
        total_tasks: total,
        completed_tasks: done,
        current_completion_rate: total > 0 ? (done / total) * 100 : 0,
      }).eq('id', goalId);
    }
  } else {
    updateGoalProgressLocal(goalId);
  }
}

// ─── Daily tasks ───────────────────────────────────────────────────────────────
export async function getTodaysTasks(): Promise<DailyTask[]> {
  const today = format(new Date(), 'yyyy-MM-dd');

  if (isPremium()) {
    const { data: goals } = await supabase
      .from('goals')
      .select('id')
      .eq('status', 'active');
    const goalIds = goals?.map((g: any) => g.id) ?? [];
    if (!goalIds.length) return [];

    const { data: tasks } = await supabase
      .from('daily_tasks')
      .select('*')
      .in('goal_id', goalIds)
      .eq('scheduled_date', today)
      .order('priority', { ascending: false })
      .order('created_at');
    return (tasks ?? []) as DailyTask[];
  }

  const activeGoalIds = getAllGoalsLocal()
    .filter((g) => g.status === 'active')
    .map((g) => g.id);
  if (!activeGoalIds.length) return [];
  return getTodaysTasksLocal(activeGoalIds);
}

export async function getUpcomingTasks(endDate: string): Promise<Record<string, DailyTask[]>> {
  const today = format(new Date(), 'yyyy-MM-dd');

  let tasks: DailyTask[] = [];

  if (isPremium()) {
    const { data } = await supabase
      .from('daily_tasks')
      .select('*')
      .gte('scheduled_date', today)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')
      .order('priority', { ascending: false });
    tasks = (data ?? []) as DailyTask[];
  } else {
    tasks = getTasksByDateRangeLocal(today, endDate);
  }

  const grouped: Record<string, DailyTask[]> = {};
  for (const task of tasks) {
    if (!grouped[task.scheduled_date]) grouped[task.scheduled_date] = [];
    grouped[task.scheduled_date].push(task);
  }
  return grouped;
}

export async function toggleTaskCompletion(taskId: string, currentlyCompleted: boolean): Promise<void> {
  const newCompleted = !currentlyCompleted;
  if (isPremium()) {
    await supabase.from('daily_tasks').update(
      newCompleted
        ? { completed: true, completed_at: new Date().toISOString() }
        : { completed: false, completed_at: null, failed: false, failure_reason: null }
    ).eq('id', taskId);
  } else {
    markTaskCompleteLocal(taskId, newCompleted);
  }
}

export async function submitFailureReason(taskId: string, reason: string): Promise<void> {
  if (isPremium()) {
    await supabase.from('daily_tasks').update({ failed: true, failure_reason: reason }).eq('id', taskId);
    // Fire AI adjustment in background — premium only
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-adjust-plan`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ taskId, failureReason: reason }),
          }
        );
      } catch (err) {
        console.error('[ai-adjust-plan] Background call failed:', err);
      }
    })();
  } else {
    markTaskFailedLocal(taskId, reason);
  }
}

export async function getTasksForDateRange(
  goalId: string,
  startDate: string,
  endDate: string
): Promise<DailyTask[]> {
  if (isPremium()) {
    const { data } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('goal_id', goalId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')
      .order('priority', { ascending: false });
    return (data ?? []) as DailyTask[];
  }
  return getTasksByDateRangeLocal(startDate, endDate);
}

// ─── Analytics ─────────────────────────────────────────────────────────────────
export async function getAnalyticsTasks(goalId?: string): Promise<DailyTask[]> {
  if (isPremium()) {
    let query = supabase.from('daily_tasks').select('*');
    if (goalId) query = query.eq('goal_id', goalId);
    const { data } = await query;
    return (data ?? []) as DailyTask[];
  }
  const activeGoalIds = getAllGoalsLocal()
    .filter((g) => g.status === 'active')
    .map((g) => g.id);
  if (!activeGoalIds.length) return [];
  return getTasksForGoalsLocal(activeGoalIds);
}

export async function getFailureReasons(userId?: string): Promise<Array<{ user_reason: string }>> {
  if (isPremium()) {
    let query = supabase.from('task_failures').select('user_reason').limit(50);
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    return (data ?? []) as Array<{ user_reason: string }>;
  }
  return getFailureReasonsLocal();
}

// ─── Goal-detail operations ────────────────────────────────────────────────────

export async function getGoalById(goalId: string): Promise<Goal | null> {
  if (isPremium()) {
    const { data } = await supabase.from('goals').select('*').eq('id', goalId).maybeSingle();
    return data ?? null;
  }
  return getGoalByIdLocal(goalId);
}

export async function getHabitsForGoal(
  goalId: string
): Promise<Array<{ id: string; habit_text: string }>> {
  if (isPremium()) {
    const { data } = await supabase
      .from('habits')
      .select('id, habit_text')
      .eq('goal_id', goalId)
      .order('created_at');
    return (data ?? []) as Array<{ id: string; habit_text: string }>;
  }
  return getHabitsForGoalLocal(goalId);
}

export async function getUpcomingTaskTitlesForGoal(
  goalId: string,
  fromDate: string
): Promise<Array<{ task_title: string; scheduled_date: string }>> {
  if (isPremium()) {
    const { data } = await supabase
      .from('daily_tasks')
      .select('task_title, scheduled_date')
      .eq('goal_id', goalId)
      .gte('scheduled_date', fromDate)
      .limit(200);
    return (data ?? []) as Array<{ task_title: string; scheduled_date: string }>;
  }
  return getUpcomingTaskTitlesLocal(goalId, fromDate);
}

export async function updateGoalText(
  goalId: string,
  goalText: string,
  timelineMonths: number
): Promise<void> {
  if (isPremium()) {
    await supabase
      .from('goals')
      .update({ goal_text: goalText, timeline_months: timelineMonths })
      .eq('id', goalId);
  } else {
    updateGoalTextLocal(goalId, goalText, timelineMonths);
  }
}

export async function deleteGoal(goalId: string): Promise<void> {
  if (isPremium()) {
    await supabase.from('goals').delete().eq('id', goalId);
  } else {
    deleteGoalLocal(goalId);
  }
}

export async function deleteHabitAndFutureTasks(
  habitId: string,
  goalId: string,
  habitText: string,
  fromDate: string
): Promise<void> {
  if (isPremium()) {
    await supabase
      .from('daily_tasks')
      .delete()
      .eq('goal_id', goalId)
      .eq('task_title', habitText)
      .gte('scheduled_date', fromDate);
    await supabase.from('habits').delete().eq('id', habitId);
  } else {
    deleteTasksByHabitLocal(goalId, habitText, fromDate);
    deleteHabitLocal(habitId);
  }
}

export async function updateHabitSchedule(
  habitId: string,
  goalId: string,
  habitText: string,
  fromDate: string,
  newDays: number[]
): Promise<void> {
  if (isPremium()) {
    await supabase
      .from('daily_tasks')
      .delete()
      .eq('goal_id', goalId)
      .eq('task_title', habitText)
      .gte('scheduled_date', fromDate);

    if (newDays.length > 0) {
      const start = new Date();
      const taskRows = eachDayOfInterval({ start, end: addDays(start, 29) })
        .filter((day) => newDays.includes(day.getDay()))
        .map((day) => ({
          goal_id: goalId,
          task_title: habitText,
          scheduled_date: format(day, 'yyyy-MM-dd'),
          estimated_minutes: 0,
          priority: 'medium',
          completed: false,
          failed: false,
        }));
      if (taskRows.length > 0) await supabase.from('daily_tasks').insert(taskRows);
    }

    await supabase.from('habits').update({ frequency_days: newDays.length }).eq('id', habitId);
  } else {
    deleteTasksByHabitLocal(goalId, habitText, fromDate);
    if (newDays.length > 0) insertTasksForHabitLocal(goalId, habitText, newDays);
    updateHabitDaysLocal(habitId, newDays.length);
  }
}

// ─── Settings (theme) ──────────────────────────────────────────────────────────
const THEME_KEY = 'local_theme';

export async function saveThemeLocally(theme: 'dark' | 'light'): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(THEME_KEY, theme);
}

export async function loadThemeLocally(): Promise<'dark' | 'light' | null> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const stored = await AsyncStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'light' ? stored : null;
}
