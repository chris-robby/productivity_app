import { create } from 'zustand';

interface ConversationStore {
  goalText: string;
  questions: string[];
  answers: Record<number, string>;
  isReeval: boolean;
  reevalGoalId: string | null;
  setGoalText: (text: string) => void;
  setQuestions: (questions: string[]) => void;
  setAnswer: (index: number, answer: string) => void;
  setReeval: (goalId: string, goalText: string) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  goalText: '',
  questions: [],
  answers: {},
  isReeval: false,
  reevalGoalId: null,

  setGoalText: (text) => set({ goalText: text }),
  setQuestions: (questions) => set({ questions }),
  setAnswer: (index, answer) =>
    set((state) => ({ answers: { ...state.answers, [index]: answer } })),
  setReeval: (goalId, goalText) =>
    set({ isReeval: true, reevalGoalId: goalId, goalText }),
  reset: () =>
    set({ goalText: '', questions: [], answers: {}, isReeval: false, reevalGoalId: null }),
}));
