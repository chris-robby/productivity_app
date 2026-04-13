import { create } from 'zustand';
import { Goal, RoadmapPhase, GoalStore } from '../types';
import { supabase } from '../lib/supabase';
import { getActiveGoal } from '../services/database/adapter';
import { useTierStore } from './tierStore';

export const useGoalStore = create<GoalStore>((set) => ({
  currentGoal: null,
  roadmapPhases: [],

  setCurrentGoal: (goal) => set({ currentGoal: goal }),

  setRoadmapPhases: (phases) => set({ roadmapPhases: phases }),

  loadGoal: async (goalId: string) => {
    try {
      const tier = useTierStore.getState().tier;

      if (tier === 'free') {
        // Free users have no roadmap phases — just load the goal from SQLite
        const goal = await getActiveGoal();
        if (goal && goal.id === goalId) {
          set({ currentGoal: goal, roadmapPhases: [] });
        }
        return;
      }

      // Premium: full Supabase fetch including roadmap phases
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .single();

      if (goalError) throw goalError;

      const { data: phases, error: phasesError } = await supabase
        .from('roadmap_phases')
        .select('*')
        .eq('goal_id', goalId)
        .order('phase_number');

      if (phasesError) throw phasesError;

      set({
        currentGoal: goal as Goal,
        roadmapPhases: phases as RoadmapPhase[],
      });
    } catch (error) {
      console.error('Error loading goal:', error);
      throw error;
    }
  },
}));
