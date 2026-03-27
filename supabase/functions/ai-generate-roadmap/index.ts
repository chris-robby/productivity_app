import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const prompt = `You are creating a detailed, actionable roadmap for this goal:

Goal: ${goalData.goal}
Timeline: ${goalData.timelineMonths || 6} months
Start Date: ${today}
Target Date: ${target}
${goalData.userContext ? `About the user: ${goalData.userContext}` : ''}
Q&A Context: ${JSON.stringify(goalData.context)}

Create a comprehensive roadmap with:
1. 2-3 major phases spanning the entire timeline (e.g., "Month 1-2: Foundation")
2. Weekly milestones for each phase
3. Daily actionable tasks for the FIRST 15 days only

Important:
- Task titles must be short (5 words max), plain, and action-first. Use simple everyday words: "eat" not "consume", "read" not "review documentation", "walk" not "perform ambulation". Write like you're texting a friend, not writing a report.
- Task descriptions should be 1-2 plain sentences explaining exactly what to do
- Estimate realistic time for each task (in minutes)
- Prioritize tasks (high/medium/low)
- Make early tasks easier to build momentum
- Each task should move toward the goal

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
          temperature: 0.7,
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingBudget: 0 },
        }
      })
    });

    if (!geminiResponse.ok) {
      const errData = await geminiResponse.json().catch(() => ({}));
      if (geminiResponse.status === 429) {
        throw new Error('AI usage limit reached. Please wait a minute and try again.');
      }
      throw new Error(errData?.error?.message || 'Failed to generate roadmap');
    }

    const geminiData = await geminiResponse.json();
    const candidate = geminiData.candidates?.[0];
    const aiText = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason = candidate?.finishReason;

    if (finishReason === 'MAX_TOKENS' || !aiText) {
      throw new Error('Roadmap generation was cut off. Please try again.');
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
