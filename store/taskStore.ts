import { create } from 'zustand';
import { DailyTask, TaskStore } from '../types';
import {
  getTodaysTasks,
  getUpcomingTasks,
  toggleTaskCompletion as adapterToggle,
  submitFailureReason as adapterSubmitFailure,
} from '../services/database/adapter';

export const useTaskStore = create<TaskStore>((set, get) => ({
  todaysTasks: [],
  upcomingTasks: {},

  setTodaysTasks: (tasks) => set({ todaysTasks: tasks }),

  loadTodaysTasks: async () => {
    try {
      const tasks = await getTodaysTasks();
      set({ todaysTasks: tasks });
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  },

  loadUpcomingTasks: async (endDate: string) => {
    try {
      const grouped = await getUpcomingTasks(endDate);
      set({ upcomingTasks: grouped });
    } catch (error) {
      console.error('Error loading upcoming tasks:', error);
    }
  },

  toggleTaskCompletion: async (taskId: string) => {
    try {
      const task = get().todaysTasks.find((t) => t.id === taskId);
      if (!task) return;

      await adapterToggle(taskId, task.completed);

      const newCompleted = !task.completed;
      set({
        todaysTasks: get().todaysTasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: newCompleted,
                completed_at: newCompleted ? new Date().toISOString() : undefined,
                ...(newCompleted ? {} : { failed: false, failure_reason: undefined }),
              }
            : t
        ),
      });
    } catch (error) {
      console.error('Error toggling task:', error);
      throw error;
    }
  },

  submitFailureReason: async (taskId: string, reason: string) => {
    try {
      await adapterSubmitFailure(taskId, reason);

      set({
        todaysTasks: get().todaysTasks.map((t) =>
          t.id === taskId ? { ...t, failed: true, failure_reason: reason } : t
        ),
      });
    } catch (error) {
      console.error('Error submitting failure reason:', error);
      throw error;
    }
  },
}));
