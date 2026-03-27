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
    if (response.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(errData?.error?.message || 'AI is currently unavailable. Please try again later.');
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 },
      }
    })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'AI is currently unavailable. Please try again later.');
  }
  const geminiData = await response.json();
  const candidate = geminiData.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? '';
  if (candidate?.finishReason === 'MAX_TOKENS' || !text) {
    throw new Error('AI response was cut off. Please try again.');
  }
  return text;
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

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    const { goalText, userContext, previousAnswers } = await req.json();

    // Format previous Q&A into readable lines (format: { q1, a1, q2, a2, ... })
    const previousAnswersFormatted = (() => {
      if (!previousAnswers || Object.keys(previousAnswers).length === 0) return null;
      const pairs: string[] = [];
      let i = 1;
      while (previousAnswers[`q${i}`]) {
        const q = previousAnswers[`q${i}`];
        const a = previousAnswers[`a${i}`];
        if (a) pairs.push(`- ${q} → ${a}`);
        i++;
      }
      return pairs.length > 0 ? pairs.join('\n') : null;
    })();

    const prompt = `Someone wants to achieve this goal: "${goalText}"
${userContext ? `\nAbout them: ${userContext}` : ''}
${previousAnswersFormatted ? `\nALREADY KNOWN — do not ask about ANY of these again, ever:\n${previousAnswersFormatted}` : ''}

Do two things:

1. Rewrite the goal as one sentence that passes all three of these tests:
   - SPECIFIC: what exactly will be achieved? (not "get fit" — what does fit mean for them?)
   - MEASURABLE: a real number or clear outcome you can check (kg gained, km run, £ earned, words spoken)
   - TIME-BOUND: includes a deadline or timeframe (use what they gave, or pick a realistic one)
   Good examples: "get fit" → "Run a 5K in under 30 minutes by June", "gain muscle" → "Gain 8kg of lean muscle in 6 months training 4x per week", "learn Spanish" → "Hold a 10-minute conversation in Spanish within 6 months".
   If you don't have enough info to add a number yet, use a sensible realistic default — you can always refine after the questions.

2. Write ${previousAnswersFormatted ? '3 to 4' : '3 to 5'} questions to fill in gaps you genuinely don't know yet.
${previousAnswersFormatted ? `
STRICT RULES for re-evaluation questions:
- The "ALREADY KNOWN" section above is off limits. Do not ask about anything in it.
- Do not ask about body weight, height, fitness level, experience, or any physical stats if those are already answered.
- Only ask about what has CHANGED or what is genuinely missing.
- If you have enough info already, ask fewer questions (minimum 3).
` : `
Ask about: current starting point, hours available per week, timeline preference, any budget or equipment limits, past attempts.
`}
Question style: casual, one sentence, like a friend asking. No formal language. No words like "optimal", "utilise", "facilitate".

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "redefinedGoal": "specific one-sentence goal",
  "questions": ["Question one?", "Question two?", "Question three?"]
}`;

    let aiText: string;
    try {
      aiText = await callGroq(prompt, 1024);
    } catch (err) {
      if (err.message === 'RATE_LIMITED') {
        aiText = await callGemini(prompt, 1024);
      } else {
        throw err;
      }
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
