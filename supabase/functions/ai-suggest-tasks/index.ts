import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { detectCategory, getTemplate } from "../_shared/templates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_NAMES: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

function formatDays(days: number[]): string {
  if (days.length === 7) return 'every day';
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY')!;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'AI is currently unavailable. Please try again later.');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const { goalId, goal, userContext } = await req.json();

    // Fetch current habits for this goal
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('habit_text')
      .eq('goal_id', goalId);

    if (habitsError) throw habitsError;

    // Fetch upcoming daily_tasks to infer which days each habit is scheduled
    const today = new Date().toISOString().split('T')[0];
    const { data: upcomingTasks } = await supabase
      .from('daily_tasks')
      .select('task_title, scheduled_date')
      .eq('goal_id', goalId)
      .gte('scheduled_date', today)
      .limit(100);

    // Build a frequency map: task_title -> Set of day-of-week numbers
    const taskDayMap: Record<string, Set<number>> = {};
    for (const t of (upcomingTasks ?? [])) {
      const dow = new Date(t.scheduled_date + 'T00:00:00').getDay();
      if (!taskDayMap[t.task_title]) taskDayMap[t.task_title] = new Set();
      taskDayMap[t.task_title].add(dow);
    }

    // Format current habits for the prompt
    const habitLines = (habits ?? []).map((h) => {
      const days = taskDayMap[h.habit_text];
      const dayStr = days ? formatDays(Array.from(days)) : 'unscheduled';
      return `- "${h.habit_text}" (${dayStr})`;
    }).join('\n');

    const contextBlock = userContext ? `\nAbout the user: ${userContext}` : '';

    const category = detectCategory(goal);
    const template = getTemplate(category);

    const systemPrompt = `You are a productivity coach reviewing a user's self-designed action plan. Your job is to suggest additional tasks that complement what they are already doing — not replace it.

Rules:
- Be specific with numbers, thresholds, and targets — never generic. Use real values from the domain expertise below (e.g. "Hit 1.6g/kg protein daily", "Add 2.5kg to each lift", "Review 20 flashcards", not "Eat more protein" or "Study").
- Each suggestion must feel like a direct, actionable extension of the user's current plan.
- The "howTo" field must explain concretely how to execute the task: exact steps, amounts, timing, or method — not just what it is.

Use the domain expertise below to inform specifics:

${template}

Return ONLY a JSON array with no extra text.`;

    const userPrompt = `Goal: "${goal}"${contextBlock}

Current tasks:
${habitLines || '(none yet)'}

Suggest at least 10 additional tasks that would strengthen this plan. Consider gaps like: missing review or reflection habits, recovery, nutrition targets, tracking, or consistency support.

IMPORTANT:
- Each "task" must be 6 words or fewer — short and action-focused.
- Use real numbers and specific targets in the task name where possible.
- "reason" = 1 sentence on why this matters for their specific goal.
- "howTo" = 2–4 sentences explaining exactly how to do it: what to do, when, how much, and any technique details.

Return a JSON array in this exact format:
[
  {
    "task": "Short action (max 6 words)",
    "reason": "One sentence on why this helps their specific goal.",
    "howTo": "Concrete step-by-step explanation of how to do this, with specific numbers, timing, and technique where relevant.",
    "suggestedDays": [1, 3, 5]
  }
]

Use day numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.`;

    const raw = await callGroq(systemPrompt, userPrompt);

    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI returned an unexpected response format.');

    let suggestions;
    try {
      suggestions = JSON.parse(match[0]);
    } catch {
      // Response was truncated — salvage all complete objects
      const partial = match[0].replace(/,?\s*\{[^{}]*$/, ']');
      suggestions = JSON.parse(partial);
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Something went wrong' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
