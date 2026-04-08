import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { detectCategory, getTemplate } from "../_shared/templates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGroq(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
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

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  model: string,
  thinkingBudget: number
): Promise<string> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget },
      }
    })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (response.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(errData?.error?.message || `Gemini error ${response.status}`);
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? '';
  if (candidate?.finishReason === 'MAX_TOKENS' || !text) {
    throw new Error('AI response was cut off. Please try again.');
  }
  return text;
}

// Parses Q&A pairs and extracts hard constraints the AI must respect.
// Looking at the question text tells us what the answer number means,
// so "3" after "how many days can you train?" → training days, not hours.
function extractConstraints(context: Record<string, string>, goal: string): string {
  const constraints: string[] = [];
  const isFitness = /muscle|gym|weight loss|fat|run|sport|fitness|workout|train|physique/i.test(goal);

  let i = 1;
  while (context?.[`q${i}`]) {
    const q = context[`q${i}`].toLowerCase();
    const a = (context[`a${i}`] || '').trim();
    const aLower = a.toLowerCase();
    i++;

    if (!a) continue;

    // Time per session / per day
    if (/how (long|many).*(min|hour|time)|time.*available|available.*time|session.*(long|duration)/i.test(q)) {
      const m = a.match(/(\d+)\s*(hour|hr|h\b)/i);
      const m2 = a.match(/(\d+)\s*(min)/i);
      if (m) constraints.push(`Time available: ${parseInt(m[1]) * 60} minutes per session — no task should exceed this`);
      else if (m2) constraints.push(`Time available: ${m2[1]} minutes per session — no task should exceed this`);
    }

    // Days per week
    if (/how (many|often)|days.*(week|train|go)|times.*(week)|frequency/i.test(q)) {
      const m = a.match(/(\d+)/);
      if (m) constraints.push(`Frequency: ${m[1]} days per week — build the weekly rhythm around exactly this many active days`);
    }

    // Current bodyweight (not target weight)
    if (/weigh|bodyweight|body weight|how heavy/i.test(q) && !/goal|target|want to|lose|gain/i.test(q)) {
      const m = a.match(/(\d+\.?\d*)\s*(kg|lbs|pounds)/i);
      if (m) {
        const raw = parseFloat(m[1]);
        const unit = m[2].toLowerCase();
        const kg = (unit === 'lbs' || unit === 'pounds') ? Math.round(raw * 0.453) : raw;
        constraints.push(`Bodyweight: ${kg}kg`);
        if (isFitness) constraints.push(`Protein target: ${Math.round(kg * 1.6)}–${Math.round(kg * 1.8)}g per day (use the lower end for fat loss, upper end for muscle gain)`);
      }
    }

    // Experience level
    if (/experience|level|background|how long.*(train|gym|work|study|been)/i.test(q)) {
      if (/beginner|never|first time|no experience|just start|0\s*year/i.test(aLower)) {
        constraints.push('Experience: complete beginner — use only the most basic version of every task, no jargon');
      } else if (/intermediate|some|1[\-–]?2 year|couple|few year/i.test(aLower)) {
        constraints.push('Experience: intermediate');
      } else if (/advanced|experienced|\b[3-9]\+?\s*year|many year/i.test(aLower)) {
        constraints.push('Experience: advanced');
      }
    }

    // Equipment / gym access
    if (/equipment|gym|tools|kit|access|home|dumbbells?/i.test(q)) {
      constraints.push(`Equipment: ${a}`);
    }

    // Budget
    if (/budget|spend|afford|cost|money|invest/i.test(q)) {
      constraints.push(`Budget: ${a}`);
    }
  }

  if (constraints.length === 0) return '';
  return `USER CONSTRAINTS — hard limits extracted from their answers. Every single task must respect ALL of these:
${constraints.map(c => `• ${c}`).join('\n')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const { goalData, isReeval } = await req.json();

    const today = new Date().toISOString().split('T')[0];
    const weekEndDate = new Date();
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + (goalData.timelineMonths || 6));
    const target = targetDate.toISOString().split('T')[0];

    // When regenerating, always merge stored Q&A with new context so the
    // roadmap generator sees the full picture (original answers + re-eval answers).
    let resolvedContext = goalData.context;
    if (isReeval && goalData.goalId) {
      const { data: existingGoal } = await supabase
        .from('goals')
        .select('initial_conversation')
        .eq('id', goalData.goalId)
        .single();
      if (existingGoal?.initial_conversation) {
        const stored = existingGoal.initial_conversation as Record<string, string>;
        if (!resolvedContext || Object.keys(resolvedContext).length === 0) {
          // No new context — use stored entirely
          resolvedContext = stored;
        } else {
          // Merge: new answers first (q1…qN), then append old Q&A after them.
          // New questions cover what changed; old questions cover what didn't.
          const merged: Record<string, string> = { ...resolvedContext };
          let newCount = 0;
          while (merged[`q${newCount + 1}`]) newCount++;
          let oldI = 1;
          let appendI = newCount + 1;
          while (stored[`q${oldI}`]) {
            merged[`q${appendI}`] = stored[`q${oldI}`];
            merged[`a${appendI}`] = stored[`a${oldI}`] ?? '';
            oldI++;
            appendI++;
          }
          resolvedContext = merged;
        }
      }
    }

    // Context is stored as { q1: "question text", a1: "answer text", q2: ..., a2: ... }
    const contextFormatted = (() => {
      const pairs: string[] = [];
      let i = 1;
      while (resolvedContext?.[`q${i}`]) {
        const q = resolvedContext[`q${i}`];
        const a = resolvedContext[`a${i}`];
        if (a) pairs.push(`• ${q} → ${a}`);
        i++;
      }
      return pairs.join('\n') || 'No additional context provided';
    })();

    const userProfileSection = [
      goalData.userContext ? `Background: ${goalData.userContext}` : '',
      goalData.preContext ? `What changed: ${goalData.preContext}` : '',
    ].filter(Boolean).join('\n');

    // Re-evaluation uses Gemini 2.5 Pro + deep thinking (8192 token budget)
    // Initial generation uses Gemini 2.5 Flash (fast, free tier)
    const useDeepThink = Boolean(isReeval);
    const primaryModel = useDeepThink ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const thinkingBudget = useDeepThink ? 8192 : 0;

    // ── Step 1: Strategy analysis (re-evaluation only) ────────────────────────
    // The model reasons through the person's situation in plain text before
    // generating the structured plan — this dramatically improves plan quality.
    let strategyAnalysis = '';
    if (useDeepThink) {
      const analysisSystemPrompt = `You are an expert planner. Analyze a person's goal and situation before building their roadmap. Answer four specific questions in plain text. Base your answers only on what they told you — no generic advice.`;

      const analysisUserPrompt = `Goal: ${goalData.goal}
Timeline: ${goalData.timelineMonths || 6} months (${today} → ${target})
${userProfileSection ? `\n${userProfileSection}\n` : ''}
What they told us:
${contextFormatted}

Answer these four questions in plain text:
1. What is the single biggest challenge or risk for this specific person — not a generic one, but based on what they told us?
2. What must happen first and why — what's the correct order for things to build on each other?
3. What does their first week need to look like to create real momentum without overwhelming them?
4. Which of their constraints (time, budget, equipment, experience level) will shape every task the most?

Write 4 short paragraphs, one per question. Be specific. No generic advice.`;

      try {
        strategyAnalysis = await callGemini(analysisSystemPrompt, analysisUserPrompt, 2048, primaryModel, thinkingBudget);
      } catch {
        // Non-critical — if Pro is unavailable or fails, continue without the analysis step
        strategyAnalysis = '';
      }
    }

    // ── Step 2: Roadmap generation ────────────────────────────────────────────
    const category = detectCategory(goalData.goal);
    const categoryTemplate = getTemplate(category);
    const constraintsSection = extractConstraints(resolvedContext ?? {}, goalData.goal);

    // Rules go in the system prompt — they are processed separately and never
    // diluted by the growing user context below.
    const roadmapSystemPrompt = `You are a straight-talking expert coach writing a personalised plan. Apply these rules to every single task and description you write.

━━ RULE 1 — LANGUAGE ━━
Write every word as if you are texting a friend who knows nothing about this topic. Plain English only. No jargon. No formal language. If a 14-year-old would not understand a word, replace it.
- Short sentences. One idea per sentence. Never more than 20 words in a sentence.
- BANNED WORDS — never use any of these under any circumstances: log, logging, leverage, implement, utilise, utilize, optimal, actionable, facilitate, enhance, cultivate, embark, focus on, work on, explore, look into, delve, ensure, maintain, establish, incorporate, prioritise, consistency, commitment, journey, transformative, empowering, strategies, techniques, comprehensive, dedicated, it is important to, it is essential, make sure to, be sure to, in order to, additionally, furthermore, moreover, fostering, harnessing, navigating, unleash, progressive overload. Instead of "log": say "write down", "note", or "track". Instead of "progressive overload": say "add weight each session".
- Read every sentence you write. If it sounds like a motivational poster or a business report, rewrite it.
- BAD description: "Ensure you maintain a consistent workout routine by incorporating compound movements to facilitate muscle growth."
- GOOD description: "After work, go to the gym. Do 3 sets of 5 squats. Add 2.5kg from last session. That's it."

━━ RULE 2 — NO THIRD-PARTY APPS ━━
Never mention any app the user needs to download or sign up for (no MyFitnessPal, Duolingo, Anki, Stronglifts, Habitica, Google Fit, or similar). Describe the action directly. Exception: professional tools required for the actual work (LinkedIn, Figma, VS Code) are fine.

━━ RULE 3 — TASK TITLES ━━
6–10 words, start with a verb, be specific.
- BAD: "Exercise" / "Work on nutrition" / "Study"
- GOOD: "Do 3×5 squat at 60kg and write the weight down" / "Eat 160g protein across 4 meals" / "Write 10 vocabulary flashcards on past tense"

━━ RULE 4 — TASK DESCRIPTIONS ━━
Every description must follow this exact structure:
1. Habit anchor first: "After [daily habit], [do the task]."
2. Exactly what to do — be specific (weights, reps, amounts, durations, counts).
3. One sentence on why it matters: "This [does X]."
- BAD: "Focus on building a strong foundation by working on your nutrition and establishing healthy habits."
- GOOD: "After dinner, plan tomorrow's meals. Write out breakfast, lunch, snack, dinner, and add up the protein. Aim for [X]g. Knowing your numbers the night before means you won't go off track."

━━ RULE 5 — QUICK WINS (days 1–3) ━━
Days 1, 2, and 3 must be tasks that take under 15 minutes, are near-certain to succeed, but feel genuinely meaningful. The person must feel real progress from day one.

━━ RULE 6 — PERSONALISATION ━━
Every task must come directly from the user's answers. If a task could apply to a stranger with a different goal, rewrite it until it can't.

━━ RULE 7 — DOMAIN EXPERTISE ━━
You are an expert. Use real specifics:
- Fitness/muscle → real exercise names, sets × reps, protein grams from their bodyweight, rest day nutrition
- Fat loss → step counts, calorie numbers, specific food swaps, lean protein sources by name
- Language learning → grammar topics by name, vocab counts per day, conversation practice
- Business → specific tactics (cold outreach, SEO, paid ads), real revenue milestones
- Coding → specific languages, real projects to build
- Any other goal → same level of specificity

Respond ONLY with valid JSON (no markdown, no code blocks).`;

    // User context + data + build instructions go in the user message.
    // This can grow freely without affecting the rules above.
    const roadmapUserPrompt = `Goal: ${goalData.goal}
Timeline: ${goalData.timelineMonths || 6} months (${today} → ${target})
${userProfileSection ? `\n${userProfileSection}\n` : ''}${constraintsSection ? `\n${constraintsSection}\n` : ''}
Full Q&A from the user:
${contextFormatted}
${strategyAnalysis ? `\nPlanning analysis (use this to shape every decision):\n${strategyAnalysis}\n` : ''}
---

Here is an example of a high-quality roadmap for this goal type. Match this level of detail and tone — but use the user's actual numbers and situation above, not the example's:
${categoryTemplate}
---

Build:
1. 2–3 phases covering the full timeline
2. REQUIRED: every phase MUST have a "weeks" array with at least 2 entries. A phase with no "weeks" is invalid and will be rejected. Every week entry must have "weekNumber" (integer) and "focus" (string).
3. Daily tasks for this week only (7 days: ${today} → ${weekEnd}) — follow the weekly rhythm from the example template. Repeat the pattern (e.g. training day → rest day → training day) across all 7 days using the user's actual frequency from their constraints above. Do not invent random new task types after day 4.

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

    // ── AI call with fallback chain ───────────────────────────────────────────
    // Re-eval: Pro → Flash+thinking → Groq
    // Initial: Flash → Groq
    let aiText: string;
    try {
      aiText = await callGemini(roadmapSystemPrompt, roadmapUserPrompt, 16384, primaryModel, thinkingBudget);
    } catch (err) {
      if (err.message === 'RATE_LIMITED') {
        aiText = await callGroq(roadmapSystemPrompt, roadmapUserPrompt, 16384);
      } else if (useDeepThink) {
        // Pro not available — fall back to Flash with reduced thinking budget
        try {
          aiText = await callGemini(roadmapSystemPrompt, roadmapUserPrompt, 16384, 'gemini-2.5-flash', 4096);
        } catch {
          aiText = await callGroq(roadmapSystemPrompt, roadmapUserPrompt, 16384);
        }
      } else {
        throw new Error('Failed to generate roadmap. Please try again.');
      }
    }

    const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let roadmap;
    try {
      roadmap = JSON.parse(cleanedText);
    } catch {
      throw new Error('Failed to parse roadmap. Please try again.');
    }

    // ── Save to database ──────────────────────────────────────────────────────
    let goalId: string;

    if (isReeval && goalData.goalId) {
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

      await supabase.from('roadmap_phases').delete().eq('goal_id', goalId);

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

    const { error: phasesError } = await supabase.from('roadmap_phases').insert(
      roadmap.phases.map((phase: any, i: number) => ({
        goal_id: goalId,
        phase_number: i + 1,
        phase_title: phase.title,
        phase_description: phase.description,
        milestones: phase.weeks,
      }))
    );
    if (phasesError) throw phasesError;

    const allTasks = roadmap.dailyTasks.flatMap((day: any) =>
      day.tasks.map((task: any) => ({
        goal_id: goalId,
        task_title: task.title,
        task_description: task.description,
        scheduled_date: day.date,
        estimated_minutes: task.estimatedMinutes,
        priority: task.priority,
      }))
    );
    const { error: tasksError } = await supabase.from('daily_tasks').insert(allTasks);
    if (tasksError) throw tasksError;

    await supabase.from('goals')
      .update({ total_tasks: allTasks.length })
      .eq('id', goalId);

    return new Response(JSON.stringify({ success: true, goalId, roadmap }), {
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
