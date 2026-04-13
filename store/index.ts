import { create } from 'zustand';

interface AppState {
  // User session
  userId: string | null;
  setUserId: (id: string | null) => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User state
  userId: null,
  setUserId: (id) => set({ userId: id }),

  // Theme — dark by default
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
