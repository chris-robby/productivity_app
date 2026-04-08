import { supabase } from '../lib/supabase';
import {
  AIQuestionsResponse,
  AIRoadmap as AIRoadmapResponse,
  AIAdjustment as AIAdjustmentResponse,
} from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

async function getValidSession() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // Check if token expires within the next 60 seconds
    const expiresAt = session.expires_at ?? 0;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (expiresAt > nowSeconds + 60) {
      return session;
    }
  }

  // No session or token is expired/expiring soon — refresh it
  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  if (error || !refreshed) throw new Error('No active session — please log in again');
  return refreshed;
}

async function callEdgeFunction(name: string, body: object): Promise<any> {
  const session = await getValidSession();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`[${name}] HTTP ${response.status}:`, text);
    let message: string;
    try {
      message = JSON.parse(text)?.error || text;
    } catch {
      message = text;
    }
    throw new Error(message);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} returned invalid JSON: ${text}`);
  }
}

export async function fetchGoalQuestions(
  goalText: string,
  preContext?: string,
  userContext?: string,
  previousAnswers?: Record<string, string>
): Promise<AIQuestionsResponse> {
  return callEdgeFunction('ai-goal-setup', { goalText, preContext, userContext, previousAnswers });
}

export async function generateRoadmap(goalData: {
  goal: string;
  timelineMonths: number;
  context: Record<string, string>;
  userContext?: string;
}): Promise<{ goalId: string; roadmap: AIRoadmapResponse }> {
  return callEdgeFunction('ai-generate-roadmap', { goalData });
}

export async function regenerateRoadmap(goalData: {
  goalId: string;
  goal: string;
  timelineMonths: number;
  context: Record<string, string>;
  preContext: string;
  userContext?: string;
}): Promise<{ goalId: string }> {
  return callEdgeFunction('ai-generate-roadmap', { goalData, isReeval: true });
}

export async function getTaskAdjustment(
  taskId: string,
  failureReason: string
): Promise<AIAdjustmentResponse> {
  return callEdgeFunction('ai-adjust-plan', { taskId, failureReason });
}

export interface TaskSuggestion {
  task: string;
  reason: string;
  howTo: string;
  suggestedDays: number[];
}

export async function suggestTasks(
  goalId: string,
  goal: string,
  userContext?: string
): Promise<{ suggestions: TaskSuggestion[] }> {
  return callEdgeFunction('ai-suggest-tasks', { goalId, goal, userContext });
}
