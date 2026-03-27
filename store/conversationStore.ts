import { create } from 'zustand';

interface ConversationStore {
  goalText: string;
  userContext: string;
  questions: string[];
  answers: Record<number, string>;
  isReeval: boolean;
  reevalGoalId: string | null;
  setGoalText: (text: string) => void;
  setUserContext: (context: string) => void;
  setQuestions: (questions: string[]) => void;
  setAnswer: (index: number, answer: string) => void;
  setReeval: (goalId: string, goalText: string, userContext?: string) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  goalText: '',
  userContext: '',
  questions: [],
  answers: {},
  isReeval: false,
  reevalGoalId: null,

  setGoalText: (text) => set({ goalText: text }),
  setUserContext: (context) => set({ userContext: context }),
  setQuestions: (questions) => set({ questions }),
  setAnswer: (index, answer) =>
    set((state) => ({ answers: { ...state.answers, [index]: answer } })),
  setReeval: (goalId, goalText, userContext = '') =>
    set({ isReeval: true, reevalGoalId: goalId, goalText, userContext }),
  reset: () =>
    set({ goalText: '', userContext: '', questions: [], answers: {}, isReeval: false, reevalGoalId: null }),
}));
