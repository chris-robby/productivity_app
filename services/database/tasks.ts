import { supabase } from '../supabase';
import { DailyTask } from '../../types';
import { format } from 'date-fns';

/**
 * Get all tasks for today
 */
export async function getTodayTasks(): Promise<DailyTask[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('scheduled_date', today)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching today tasks:', error);
    throw error;
  }

  return data || [];
}

/**
 * Toggle task completion status
 */
export async function toggleTaskCompletion(taskId: string, completed: boolean): Promise<void> {
  const updates: Partial<DailyTask> = {
    completed,
    completed_at: completed ? new Date().toISOString() : undefined,
  };

  const { error } = await supabase
    .from('daily_tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

/**
 * Mark task as failed and save reason
 */
export async function recordTaskFailure(
  taskId: string,
  reason: string,
  category: string
): Promise<void> {
  const { error } = await supabase
    .from('daily_tasks')
    .update({
      failed: true,
      failure_reason: reason,
      failure_category: category,
    })
    .eq('id', taskId);

  if (error) {
    console.error('Error recording failure:', error);
    throw error;
  }

  // Also record in task_failures table
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    await supabase.from('task_failures').insert({
      task_id: taskId,
      user_id: user.id,
      failure_date: new Date().toISOString(),
      user_reason: reason,
      ai_categorization: category,
    });
  }
}

/**
 * Get incomplete tasks from today
 */
export async function getIncompleteTasks(): Promise<DailyTask[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('scheduled_date', today)
    .eq('completed', false);

  if (error) {
    console.error('Error fetching incomplete tasks:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get tasks for a specific date range
 */
export async function getTasksInRange(startDate: string, endDate: string): Promise<DailyTask[]> {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error fetching tasks in range:', error);
    throw error;
  }

  return data || [];
}

/**
 * Reschedule a task to a new date
 */
export async function rescheduleTask(taskId: string, newDate: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('daily_tasks')
    .update({
      scheduled_date: newDate,
      was_rescheduled: true,
      reschedule_reason: reason,
    })
    .eq('id', taskId);

  if (error) {
    console.error('Error rescheduling task:', error);
    throw error;
  }
}
