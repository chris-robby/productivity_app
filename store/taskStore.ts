import { create } from 'zustand';
import { DailyTask, TaskStore } from '../types';
import { supabase } from '../lib/supabase';

export const useTaskStore = create<TaskStore>((set, get) => ({
  todaysTasks: [],
  upcomingTasks: {},

  setTodaysTasks: (tasks) => set({ todaysTasks: tasks }),

  loadTodaysTasks: async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Scope tasks to active goals only — prevents tasks from abandoned/completed goals bleeding in
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('status', 'active');

      const goalIds = goals?.map((g) => g.id) ?? [];
      if (!goalIds.length) {
        set({ todaysTasks: [] });
        return;
      }

      const { data: tasks, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .in('goal_id', goalIds)
        .eq('scheduled_date', today)
        .order('priority', { ascending: false })
        .order('created_at');

      if (error) throw error;

      set({ todaysTasks: tasks as DailyTask[] });
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  },

  loadUpcomingTasks: async (endDate: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: tasks, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .gte('scheduled_date', today)
        .lte('scheduled_date', endDate)
        .order('scheduled_date')
        .order('priority', { ascending: false });

      if (error) throw error;

      const grouped: Record<string, DailyTask[]> = {};
      for (const task of (tasks as DailyTask[])) {
        if (!grouped[task.scheduled_date]) grouped[task.scheduled_date] = [];
        grouped[task.scheduled_date].push(task);
      }

      set({ upcomingTasks: grouped });
    } catch (error) {
      console.error('Error loading upcoming tasks:', error);
    }
  },
  
  toggleTaskCompletion: async (taskId: string) => {
    try {
      const tasks = get().todaysTasks;
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) return;
      
      const newCompleted = !task.completed;
      
      // Update in database
      const { error } = await supabase
        .from('daily_tasks')
        .update({ 
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null
        })
        .eq('id', taskId);
      
      if (error) throw error;
      
      // Update local state
      set({
        todaysTasks: tasks.map(t => 
          t.id === taskId 
            ? { ...t, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : undefined }
            : t
        )
      });
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  },
  
  submitFailureReason: async (taskId: string, reason: string) => {
    try {
      // Mark task as failed in DB
      const { error } = await supabase
        .from('daily_tasks')
        .update({ failed: true, failure_reason: reason })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state directly — task stays on the list
      set({
        todaysTasks: get().todaysTasks.map((t) =>
          t.id === taskId ? { ...t, failed: true, failure_reason: reason } : t
        ),
      });

      // Fire AI adjustment in the background — do not await, do not affect the list
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-adjust-plan`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ taskId, failureReason: reason }),
          }
        ).catch((error) => {
          console.error('[ai-adjust-plan] Background adjustment failed:', error);
        });
      });
    } catch (error) {
      console.error('Error submitting failure reason:', error);
      throw error;
    }
  },
}));
