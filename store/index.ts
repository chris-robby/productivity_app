import { create } from 'zustand';
import { Goal, DailyTask, ConversationMessage, AIConversation } from '../types';

interface AppState {
  // Current user's active goal
  currentGoal: Goal | null;
  setCurrentGoal: (goal: Goal | null) => void;

  // Today's tasks
  todayTasks: DailyTask[];
  setTodayTasks: (tasks: DailyTask[]) => void;
  toggleTaskComplete: (taskId: string) => void;
  updateTask: (taskId: string, updates: Partial<DailyTask>) => void;

  // Goal setup conversation
  conversation: ConversationMessage[];
  addMessage: (message: ConversationMessage) => void;
  clearConversation: () => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // User session
  userId: string | null;
  setUserId: (id: string | null) => void;

  // Demo mode
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Goal state
  currentGoal: null,
  setCurrentGoal: (goal) => set({ currentGoal: goal }),

  // Tasks state
  todayTasks: [],
  setTodayTasks: (tasks) => set({ todayTasks: tasks }),
  toggleTaskComplete: (taskId) =>
    set((state) => ({
      todayTasks: state.todayTasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : undefined }
          : task
      ),
    })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      todayTasks: state.todayTasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    })),

  // Conversation state
  conversation: [],
  addMessage: (message) =>
    set((state) => ({ conversation: [...state.conversation, message] })),
  clearConversation: () => set({ conversation: [] }),

  // Loading state
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // User state
  userId: null,
  setUserId: (id) => set({ userId: id }),

  // Demo mode
  isDemoMode: false,
  setDemoMode: (value) => set({ isDemoMode: value }),

  // Theme — dark by default
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
