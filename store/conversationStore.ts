import { create } from 'zustand';

export interface TaskEntry {
  id: string;
  text: string;
  days: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat. All 7 = every day.
}

interface ConversationStore {
  goalText: string;
  userContext: string;
  previousAnswers: Record<string, string>;
  questions: string[];
  answers: Record<number, string>;
  isReeval: boolean;
  reevalGoalId: string | null;
  tasks: TaskEntry[];
  timelineMonths: number;
  setGoalText: (text: string) => void;
  setUserContext: (context: string) => void;
  setQuestions: (questions: string[]) => void;
  setAnswer: (index: number, answer: string) => void;
  setReeval: (goalId: string, goalText: string, userContext?: string, previousAnswers?: Record<string, string>) => void;
  setTasks: (tasks: TaskEntry[]) => void;
  setTimeline: (months: number) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  goalText: '',
  userContext: '',
  previousAnswers: {},
  questions: [],
  answers: {},
  isReeval: false,
  reevalGoalId: null,
  tasks: [],
  timelineMonths: 3,

  setGoalText: (text) => set({ goalText: text }),
  setUserContext: (context) => set({ userContext: context }),
  setQuestions: (questions) => set({ questions }),
  setAnswer: (index, answer) =>
    set((state) => ({ answers: { ...state.answers, [index]: answer } })),
  setReeval: (goalId, goalText, userContext = '', previousAnswers = {}) =>
    set({ isReeval: true, reevalGoalId: goalId, goalText, userContext, previousAnswers }),
  setTasks: (tasks) => set({ tasks }),
  setTimeline: (months) => set({ timelineMonths: months }),
  reset: () =>
    set({
      goalText: '',
      userContext: '',
      previousAnswers: {},
      questions: [],
      answers: {},
      isReeval: false,
      reevalGoalId: null,
      tasks: [],
      timelineMonths: 3,
    }),
}));
