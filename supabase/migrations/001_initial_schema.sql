-- Productivity App Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Goals table
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_text TEXT NOT NULL,
  timeline_months INTEGER,
  target_date DATE,
  status TEXT CHECK (status IN ('active', 'completed', 'abandoned')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- AI conversation stored
  initial_conversation JSONB DEFAULT '[]'::jsonb,
  
  -- Track progress
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  current_completion_rate DECIMAL(5,2) DEFAULT 0
);

-- Roadmap phases table
CREATE TABLE roadmap_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  phase_number INTEGER NOT NULL,
  phase_title TEXT NOT NULL,
  phase_description TEXT,
  start_date DATE,
  end_date DATE,
  milestones JSONB DEFAULT '[]'::jsonb,
  
  -- Track if AI revised this phase
  revision_number INTEGER DEFAULT 1,
  revised_at TIMESTAMP WITH TIME ZONE,
  revision_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily tasks table
CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  roadmap_phase_id UUID REFERENCES roadmap_phases(id) ON DELETE SET NULL,
  
  task_title TEXT NOT NULL,
  task_description TEXT,
  scheduled_date DATE NOT NULL,
  estimated_minutes INTEGER,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  
  -- Completion tracking
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Failure tracking
  failed BOOLEAN DEFAULT FALSE,
  failure_reason TEXT,
  failure_category TEXT CHECK (failure_category IN ('time', 'energy', 'motivation', 'external', 'other')),
  
  -- AI adjustment tracking
  was_rescheduled BOOLEAN DEFAULT FALSE,
  original_date DATE,
  reschedule_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Link to conversation about this task
  ai_context JSONB
);

-- Task failures table (for AI learning)
CREATE TABLE task_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES daily_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  failure_date DATE NOT NULL,
  user_reason TEXT NOT NULL,
  ai_categorization TEXT,
  
  -- Pattern detection
  time_of_day TEXT,
  day_of_week TEXT,
  task_type TEXT,
  
  -- AI response
  ai_adjustment_made TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI conversations table
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  
  conversation_type TEXT CHECK (conversation_type IN ('goal_setup', 'clarifying', 'adjustment', 'check_in')),
  
  messages JSONB DEFAULT '[]'::jsonb,
  
  -- Outcomes
  roadmap_generated BOOLEAN DEFAULT FALSE,
  tasks_created INTEGER DEFAULT 0,
  tasks_adjusted INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress snapshots table (daily analytics)
CREATE TABLE progress_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  snapshot_date DATE NOT NULL,
  
  tasks_due_today INTEGER DEFAULT 0,
  tasks_completed_today INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  
  total_failures_to_date INTEGER DEFAULT 0,
  common_failure_patterns JSONB,
  
  ai_confidence_score DECIMAL(5,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(goal_id, snapshot_date)
);

-- User settings table
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  alarm_time TIME,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  theme TEXT DEFAULT 'light',
  ai_features_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Goals policies
CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

-- Roadmap phases policies
CREATE POLICY "Users can view their own roadmap phases"
  ON roadmap_phases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = roadmap_phases.goal_id AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert roadmap phases for their goals"
  ON roadmap_phases FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = roadmap_phases.goal_id AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own roadmap phases"
  ON roadmap_phases FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = roadmap_phases.goal_id AND goals.user_id = auth.uid()
  ));

-- Daily tasks policies
CREATE POLICY "Users can view their own tasks"
  ON daily_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = daily_tasks.goal_id AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert tasks for their goals"
  ON daily_tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = daily_tasks.goal_id AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own tasks"
  ON daily_tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = daily_tasks.goal_id AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own tasks"
  ON daily_tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = daily_tasks.goal_id AND goals.user_id = auth.uid()
  ));

-- Task failures policies
CREATE POLICY "Users can view their own task failures"
  ON task_failures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task failures"
  ON task_failures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- AI conversations policies
CREATE POLICY "Users can view their own AI conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Progress snapshots policies
CREATE POLICY "Users can view their own progress snapshots"
  ON progress_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = progress_snapshots.goal_id AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert progress snapshots for their goals"
  ON progress_snapshots FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = progress_snapshots.goal_id AND goals.user_id = auth.uid()
  ));

-- User settings policies
CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for better performance
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_daily_tasks_goal_id ON daily_tasks(goal_id);
CREATE INDEX idx_daily_tasks_scheduled_date ON daily_tasks(scheduled_date);
CREATE INDEX idx_daily_tasks_completed ON daily_tasks(completed);
CREATE INDEX idx_task_failures_user_id ON task_failures(user_id);
CREATE INDEX idx_progress_snapshots_goal_id ON progress_snapshots(goal_id);
CREATE INDEX idx_progress_snapshots_date ON progress_snapshots(snapshot_date);

-- Function to create initial user settings
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create settings when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_settings();
