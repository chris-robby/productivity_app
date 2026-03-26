import { create } from 'zustand';
import { Goal, RoadmapPhase, GoalStore } from '../types';
import { supabase } from '../lib/supabase';

export const useGoalStore = create<GoalStore>((set) => ({
  currentGoal: null,
  roadmapPhases: [],
  
  setCurrentGoal: (goal) => set({ currentGoal: goal }),
  
  setRoadmapPhases: (phases) => set({ roadmapPhases: phases }),
  
  loadGoal: async (goalId: string) => {
    try {
      // Load goal
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .single();
      
      if (goalError) throw goalError;
      
      // Load roadmap phases
      const { data: phases, error: phasesError } = await supabase
        .from('roadmap_phases')
        .select('*')
        .eq('goal_id', goalId)
        .order('phase_number');
      
      if (phasesError) throw phasesError;
      
      set({ 
        currentGoal: goal as Goal, 
        roadmapPhases: phases as RoadmapPhase[] 
      });
    } catch (error) {
      console.error('Error loading goal:', error);
    }
  },
}));
