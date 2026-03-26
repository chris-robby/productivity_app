import { supabase } from '../supabase';
import { AIQuestionsResponse, AIRoadmap, AIAdjustment } from '../../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');
  return `Bearer ${session.access_token}`;
}

/**
 * Fetch all clarifying questions for a goal in one call
 */
export async function fetchGoalQuestions(goalText: string): Promise<AIQuestionsResponse> {
  const auth = await getAuthHeader();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-goal-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({ goalText }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get questions');
  return data;
}

/**
 * Generate complete roadmap from goal + collected answers
 */
export async function generateRoadmap(goalData: {
  goal: string;
  timelineMonths: number;
  context: Record<string, string>;
}): Promise<{ success: boolean; goalId: string; roadmap: AIRoadmap }> {
  const auth = await getAuthHeader();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate-roadmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({ goalData }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to generate roadmap');
  return data;
}

/**
 * Request AI to adjust plan based on task failure
 */
export async function requestPlanAdjustment(
  taskId: string,
  failureReason: string
): Promise<AIAdjustment> {
  const auth = await getAuthHeader();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-adjust-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({ taskId, failureReason }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to adjust plan');
  return data;
}
