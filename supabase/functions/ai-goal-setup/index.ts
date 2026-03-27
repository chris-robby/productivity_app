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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    const { goalText, userContext } = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const prompt = `You are a goal achievement coach. A user wants to achieve this goal:

"${goalText}"
${userContext ? `\nAbout the user: ${userContext}\n` : ''}
Do two things:
1. Rewrite the goal to be clear, specific, and motivating. Fix vague or unclear wording (e.g. "get fat" → "Gain 10kg of healthy body weight", "get rich" → "Build a £50k annual side income"). Keep it concise — one sentence.
2. Generate exactly 3 to 5 short clarifying questions to better understand their situation. Questions should uncover: starting point, available time per week, timeline, constraints, or previous attempts. Do not ask about things already covered in the "About the user" section above.

Rules:
- Each question must be one sentence, plain and direct
- No bullet points, numbering, or formatting in the questions
- Questions should feel like a friendly coach asking, not a form

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "redefinedGoal": "Clear, specific one-sentence version of their goal",
  "questions": [
    "Question one?",
    "Question two?",
    "Question three?"
  ]
}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        }
      })
    });

    if (!geminiResponse.ok) {
      const errData = await geminiResponse.json().catch(() => ({}));
      if (geminiResponse.status === 429) {
        throw new Error('AI usage limit reached. Please wait a minute and try again.');
      }
      throw new Error(errData?.error?.message || 'Failed to get AI response');
    }

    const geminiData = await geminiResponse.json();
    const candidate = geminiData.candidates?.[0];
    const aiText = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason = candidate?.finishReason;

    if (finishReason === 'MAX_TOKENS' || !aiText) {
      throw new Error('AI response was cut off. Please try again.');
    }

    const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch {
      throw new Error('Failed to parse AI response. Please try again.');
    }

    if (!Array.isArray(result.questions) || result.questions.length === 0 || !result.redefinedGoal) {
      throw new Error('Invalid response from AI. Please try again.');
    }

    return new Response(JSON.stringify({ redefinedGoal: result.redefinedGoal, questions: result.questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
