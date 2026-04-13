
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      temperature: 0.7,
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

    const { taskId, failureReason } = await req.json();

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) throw new Error('Task not found');

    // Get recent failure history
    const { data: failures } = await supabase
      .from('task_failures')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const failureHistory = failures?.map(f =>
      `- Task type: ${f.task_type || 'unknown'}, Reason: ${f.user_reason}, Category: ${f.ai_categorization}`
    ).join('\n') || 'No previous failures';

    // Rules and output format in system prompt — never diluted by task context.
    const systemPrompt = `You analyze why a task failed and recommend how to adjust the plan. Be direct and practical.

STRICT RULE — NO THIRD-PARTY APPS: Never mention or recommend any app the user would need to download or sign up for (no MyFitnessPal, Duolingo, Anki, Stronglifts, Habitica, Google Fit, or similar). Describe the action itself instead.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "analysis": "brief analysis of why this failed (1-2 sentences)",
  "pattern": "detected pattern or null",
  "category": "time" or "energy" or "motivation" or "external" or "other",
  "adjustments": {
    "rescheduleTask": true or false,
    "newDate": "YYYY-MM-DD" or null (3 days from now if rescheduling),
    "modifyTask": "suggested modification to make it easier" or null,
    "reasoning": "why this adjustment helps (1 sentence)"
  },
  "encouragement": "short motivational message to user (1-2 sentences)"
}`;

    // Task data and failure context in the user message.
    const userPrompt = `Failed Task: "${task.task_title}"
Description: ${task.task_description || 'No description'}
Scheduled for: ${task.scheduled_date}
Estimated time: ${task.estimated_minutes} minutes
Priority: ${task.priority}

User's reason for not completing: "${failureReason}"

Recent failure history:
${failureHistory}

Analyze:
1. Why did this specific task fail?
2. Is there a pattern in this user's failures?
3. How should we adjust the plan to help them succeed?
4. Should we reschedule this task or modify it?`;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        }
      })
    });

    let aiText: string;

    if (!geminiResponse.ok) {
      const errData = await geminiResponse.json().catch(() => ({}));
      if (geminiResponse.status === 429) {
        aiText = await callGroq(systemPrompt, userPrompt, 1024);
      } else {
        throw new Error(errData?.error?.message || 'Failed to get AI adjustment');
      }
    } else {
      const geminiData = await geminiResponse.json();
      const candidate = geminiData.candidates?.[0];
      aiText = candidate?.content?.parts?.[0]?.text ?? '';
      const finishReason = candidate?.finishReason;

      if (finishReason === 'MAX_TOKENS' || !aiText) {
        throw new Error('AI response was cut off. Please try again.');
      }
    }

    const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let adjustment;
    try {
      adjustment = JSON.parse(cleanedText);
    } catch {
      throw new Error('Failed to parse AI adjustment. Please try again.');
    }

    // Save failure record
    await supabase.from('task_failures').insert({
      task_id: taskId,
      user_id: user.id,
      failure_date: new Date().toISOString().split('T')[0],
      user_reason: failureReason,
      ai_categorization: adjustment.category,
      ai_adjustment_made: JSON.stringify(adjustment.adjustments)
    });

    // Update task with failure info
    await supabase.from('daily_tasks').update({
      failed: true,
      failure_reason: failureReason,
      failure_category: adjustment.category
    }).eq('id', taskId);

    // Apply adjustments if recommended
    if (adjustment.adjustments.rescheduleTask && adjustment.adjustments.newDate) {
      // Insert a new task on the future date instead of moving the original,
      // so the failed task stays visible on today in the journey
      await supabase.from('daily_tasks').insert({
        goal_id: task.goal_id,
        task_title: task.task_title,
        task_description: adjustment.adjustments.modifyTask || task.task_description,
        scheduled_date: adjustment.adjustments.newDate,
        estimated_minutes: task.estimated_minutes,
        priority: task.priority,
        was_rescheduled: true,
        original_date: task.scheduled_date,
        reschedule_reason: adjustment.adjustments.reasoning
      });
    }

    if (adjustment.adjustments.modifyTask && !adjustment.adjustments.rescheduleTask) {
      await supabase.from('daily_tasks').update({
        task_description: adjustment.adjustments.modifyTask
      }).eq('id', taskId);
    }

    return new Response(JSON.stringify(adjustment), {
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
