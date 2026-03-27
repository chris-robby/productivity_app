// Core type definitions for the productivity app

export interface Goal {
  id: string;
  user_id: string;
  goal_text: string;
  timeline_months: number;
  target_date: string;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
  initial_conversation: Record<string, string>;
  user_context?: string;
  total_tasks: number;
  completed_tasks: number;
  current_completion_rate: number;
}

export interface ConversationMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface RoadmapPhase {
  id: string;
  goal_id: string;
  phase_number: number;
  phase_title: string;
  phase_description: string;
  start_date: string;
  end_date: string;
  milestones: WeekMilestone[];
  revision_number: number;
  revised_at?: string;
  revision_reason?: string;
}

export interface WeekMilestone {
  weekNumber: number;
  focus: string;
  milestones: string[];
}

export interface DailyTask {
  id: string;
  goal_id: string;
  roadmap_phase_id: string;
  task_title: string;
  task_description?: string;
  scheduled_date: string;
  estimated_minutes: number;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  completed_at?: string;
  failed: boolean;
  failure_reason?: string;
  failure_category?: 'time' | 'energy' | 'motivation' | 'external' | 'other';
  was_rescheduled: boolean;
  original_date?: string;
  reschedule_reason?: string;
  created_at: string;
  ai_context?: any;
}

export interface TaskFailure {
  id: string;
  task_id: string;
  user_id: string;
  failure_date: string;
  user_reason: string;
  ai_categorization: string;
  time_of_day?: string;
  day_of_week?: string;
  task_type?: string;
  ai_adjustment_made?: string;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  goal_id?: string;
  conversation_type: 'goal_setup' | 'clarifying' | 'adjustment' | 'check_in';
  messages: ConversationMessage[];
  roadmap_generated: boolean;
  tasks_created: number;
  tasks_adjusted: number;
  created_at: string;
}

export interface ProgressSnapshot {
  id: string;
  goal_id: string;
  snapshot_date: string;
  tasks_due_today: number;
  tasks_completed_today: number;
  completion_rate: number;
  total_failures_to_date: number;
  common_failure_patterns: any;
  ai_confidence_score: number;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  alarm_time?: string;
  notifications_enabled: boolean;
  theme: 'light' | 'dark';
  ai_features_enabled: boolean;
  updated_at: string;
}

// AI Response types
export interface AIQuestionsResponse {
  redefinedGoal: string;
  questions: string[];
}

export interface AIRoadmap {
  phases: Array<{
    monthRange: string;
    title: string;
    description: string;
    weeks: WeekMilestone[];
  }>;
  dailyTasks: Array<{
    date: string;
    tasks: Array<{
      title: string;
      description: string;
      estimatedMinutes: number;
      priority: 'high' | 'medium' | 'low';
    }>;
  }>;
}

export interface AIAdjustment {
  analysis: string;
  pattern: string | null;
  category: 'time' | 'energy' | 'motivation' | 'external' | 'other';
  adjustments: {
    rescheduleTask: boolean;
    newDate: string | null;
    modifyTask: string | null;
    reasoning: string;
  };
  encouragement: string;
}
