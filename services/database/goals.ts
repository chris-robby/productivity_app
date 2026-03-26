import { supabase } from '../supabase';
import { Goal } from '../../types';

/**
 * Get current active goal for the user
 */
export async function getCurrentGoal(): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching current goal:', error);
    throw error;
  }

  return data;
}

/**
 * Get all goals for the user
 */
export async function getAllGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching goals:', error);
    throw error;
  }

  return data || [];
}

/**
 * Update goal completion progress
 */
export async function updateGoalProgress(goalId: string): Promise<void> {
  // Count total and completed tasks
  const { data: allTasks } = await supabase
    .from('daily_tasks')
    .select('id, completed')
    .eq('goal_id', goalId);

  if (allTasks) {
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(task => task.completed).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    await supabase
      .from('goals')
      .update({
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        current_completion_rate: completionRate,
      })
      .eq('id', goalId);
  }
}

/**
 * Mark goal as completed
 */
export async function completeGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'completed' })
    .eq('id', goalId);

  if (error) {
    console.error('Error completing goal:', error);
    throw error;
  }
}

/**
 * Mark goal as abandoned
 */
export async function abandonGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'abandoned' })
    .eq('id', goalId);

  if (error) {
    console.error('Error abandoning goal:', error);
    throw error;
  }
}
