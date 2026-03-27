import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY')!;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: maxTokens,
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

    const { goalData, isReeval } = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const today = new Date().toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + (goalData.timelineMonths || 6));
    const target = targetDate.toISOString().split('T')[0];

    // When regenerating, fall back to stored Q&A if caller passed empty context
    let resolvedContext = goalData.context;
    if (isReeval && goalData.goalId && (!resolvedContext || Object.keys(resolvedContext).length === 0)) {
      const { data: existingGoal } = await supabase
        .from('goals')
        .select('initial_conversation')
        .eq('id', goalData.goalId)
        .single();
      if (existingGoal?.initial_conversation) {
        resolvedContext = existingGoal.initial_conversation;
      }
    }

    // Context is stored as { q1: "question text", a1: "answer text", q2: ..., a2: ..., }
    const contextFormatted = (() => {
      const pairs: string[] = [];
      let i = 1;
      while (resolvedContext?.[`q${i}`]) {
        const q = resolvedContext[`q${i}`];
        const a = resolvedContext[`a${i}`];
        if (a) pairs.push(`- Q: ${q}\n  A: ${a}`);
        i++;
      }
      return pairs.join('\n') || 'No additional context provided';
    })();

    const prompt = `Create a roadmap for this goal:

Goal: ${goalData.goal}
Timeline: ${goalData.timelineMonths || 6} months (${today} → ${target})
${goalData.userContext ? `About this person: ${goalData.userContext}` : ''}${goalData.preContext ? `\nWhat changed: ${goalData.preContext}` : ''}

What they told us:
${contextFormatted}

---

LANGUAGE — follow strictly:
- Write like you're texting a friend. Short sentences. Simple words.
- NEVER use: "leverage", "implement", "utilise", "optimal", "actionable", "facilitate", "enhance", "cultivate", "embark", "focus on", "work on", "explore", "look into", "delve".

DOMAIN EXPERTISE — you are an expert, act like one:
- Muscle/fitness → real exercise names (bench press, squat, deadlift, pull-up, row), actual sets × reps, protein grams based on their body weight, rest days
- Language learning → specific apps (Duolingo, Anki), grammar topics by name, exact vocab counts per day
- Business/income → specific platforms, real tactics (cold outreach, SEO, paid ads), actual revenue milestones
- Coding/tech → specific languages, tutorials by name, real projects to build
- Other goals → same level of specificity — never give advice that could apply to any goal

TASK TITLES — 6–10 words, action first:
- BAD: "Exercise" / "Work on nutrition" / "Study language"
- GOOD: "Do 3×8 bench press at 60% of max weight" / "Eat 160g protein across 4 meals today" / "Learn 20 Anki cards on present tense verbs"

IMPLEMENTATION INTENTIONS (proven to double completion rates):
- Start every task description with a habit anchor: "After [existing daily habit], [do the task]."
- Pick anchors that fit the task naturally: gym/exercise → "After waking up" or "After work"; study/reading → "After dinner" or "During your lunch break"; tracking/logging → "Before bed".
- Follow the anchor with one sentence on exactly what to do.
- Example: "After breakfast, open Stronglifts and log today's session. Do 3 sets of 5 squats at your starting weight — this sets your baseline for progressive overload."

PROGRESS PRINCIPLE (small wins drive long-term motivation):
- Days 1, 2, and 3 must be "quick win" tasks: under 15 minutes, near-certain to succeed, but genuinely meaningful to the goal. The person must feel real forward progress from day one.
- End every task description with one short sentence on why it matters: "This [gives you X / builds Y / sets up Z]."
- Every task must directly use what they told you above. A task that could apply to any random person is wrong.
- Respect their available time when setting estimatedMinutes.

Build:
1. 2–3 phases covering the full timeline
2. Weekly focus for each phase
3. Daily tasks for the first 15 days only

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "phases": [
    {
      "monthRange": "1-2",
      "title": "Phase Title",
      "description": "Brief description",
      "weeks": [
        {
          "weekNumber": 1,
          "focus": "What to focus on this week",
          "milestones": ["Milestone 1", "Milestone 2"]
        }
      ]
    }
  ],
  "dailyTasks": [
    {
      "date": "${today}",
      "tasks": [
        {
          "title": "Specific task title",
          "description": "What to do",
          "estimatedMinutes": 30,
          "priority": "high"
        }
      ]
    }
  ]
}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingBudget: 0 },
        }
      })
    });

    let aiText: string;

    if (!geminiResponse.ok) {
      const errData = await geminiResponse.json().catch(() => ({}));
      if (geminiResponse.status === 429) {
        aiText = await callGroq(prompt, 16384);
      } else {
        throw new Error(errData?.error?.message || 'Failed to generate roadmap');
      }
    } else {
      const geminiData = await geminiResponse.json();
      const candidate = geminiData.candidates?.[0];
      aiText = candidate?.content?.parts?.[0]?.text ?? '';
      const finishReason = candidate?.finishReason;

      if (finishReason === 'MAX_TOKENS' || !aiText) {
        throw new Error('Roadmap generation was cut off. Please try again.');
      }
    }

    const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let roadmap;
    try {
      roadmap = JSON.parse(cleanedText);
    } catch {
      throw new Error('Failed to parse roadmap. Please try again.');
    }

    // Save to database
    let goalId: string;

    if (isReeval && goalData.goalId) {
      // Update existing goal in place
      const { error: updateError } = await supabase
        .from('goals')
        .update({
          goal_text: goalData.goal,
          timeline_months: goalData.timelineMonths || 6,
          target_date: target,
          ...(goalData.userContext !== undefined && { user_context: goalData.userContext }),
        })
        .eq('id', goalData.goalId);
      if (updateError) throw updateError;

      goalId = goalData.goalId;

      // Replace roadmap phases
      await supabase.from('roadmap_phases').delete().eq('goal_id', goalId);

      // Delete only future tasks — keep completed history
      await supabase
        .from('daily_tasks')
        .delete()
        .eq('goal_id', goalId)
        .gte('scheduled_date', today);
    } else {
      const { data: goal, error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        goal_text: goalData.goal,
        timeline_months: goalData.timelineMonths || 6,
        target_date: target,
        status: 'active',
        initial_conversation: goalData.context,
        user_context: goalData.userContext || null,
      }).select().single();

      if (goalError) throw goalError;
      goalId = goal.id;
    }

    // Save roadmap phases
    for (const phase of roadmap.phases) {
      await supabase.from('roadmap_phases').insert({
        goal_id: goalId,
        phase_number: roadmap.phases.indexOf(phase) + 1,
        phase_title: phase.title,
        phase_description: phase.description,
        milestones: phase.weeks
      });
    }

    // Save daily tasks
    for (const day of roadmap.dailyTasks) {
      for (const task of day.tasks) {
        await supabase.from('daily_tasks').insert({
          goal_id: goalId,
          task_title: task.title,
          task_description: task.description,
          scheduled_date: day.date,
          estimated_minutes: task.estimatedMinutes,
          priority: task.priority
        });
      }
    }

    // Update total tasks count
    await supabase.from('goals')
      .update({ total_tasks: roadmap.dailyTasks.reduce((sum: number, day: any) => sum + day.tasks.length, 0) })
      .eq('id', goalId);

    return new Response(JSON.stringify({
      success: true,
      goalId,
      roadmap
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
