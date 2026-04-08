// ─────────────────────────────────────────────────────────────────────────────
// Template router — detects goal category and returns the right few-shot example
//
// To add a new category:
//   1. Add a new file in this folder (e.g. cooking.ts) exporting a string
//   2. Import it here
//   3. Add a detection branch in detectCategory()
//   4. Add the entry to TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

import { TEMPLATE as fitnessMuscleTpl }      from "./fitness-muscle.ts";
import { TEMPLATE as fitnessWeightLossTpl }  from "./fitness-weight-loss.ts";
import { TEMPLATE as fitnessSportTpl }       from "./fitness-sport.ts";
import { TEMPLATE as financialTpl }          from "./financial.ts";
import { TEMPLATE as businessTpl }           from "./business.ts";
import { TEMPLATE as learningTpl }           from "./learning.ts";
import { TEMPLATE as careerTpl }             from "./career.ts";
import { TEMPLATE as healthTpl }             from "./health.ts";
import { TEMPLATE as creativeTpl }           from "./creative.ts";
import { TEMPLATE as generalTpl }            from "./general.ts";

export type GoalCategory =
  | 'fitness-muscle'
  | 'fitness-weight-loss'
  | 'fitness-sport'
  | 'financial'
  | 'business'
  | 'learning'
  | 'career'
  | 'health'
  | 'creative'
  | 'general';

export function detectCategory(goalText: string): GoalCategory {
  const t = goalText.toLowerCase();

  // ── Fitness sub-categories (order matters — check before generic fitness) ──
  if (/\b(muscle|bulk|gain weight|gain mass|build muscle|hypertrophy|strength|powerlifting|bench press|deadlift|squat|lift|gym|weights|resistance|bodybuilding)\b/.test(t)) return 'fitness-muscle';
  if (/\b(lose weight|weight loss|fat loss|slim|burn fat|cut|shred|calorie deficit|drop.*kg|drop.*lbs|lose.*kg|lose.*lbs|body fat|tone|lean out)\b/.test(t)) return 'fitness-weight-loss';
  if (/\b(run|running|marathon|5k|10k|half marathon|swim|swimming|cycling|cycle|triathlon|football|basketball|tennis|rugby|sport|athletic|endurance|pace|cardio|crossfit|yoga|martial arts|boxing|climb)\b/.test(t)) return 'fitness-sport';

  // ── Other categories ───────────────────────────────────────────────────────
  if (/\b(money|save|saving|invest|debt|income|salary|budget|financial|wealth|retirement|stocks|shares|crypto|mortgage|loan|earn|£|\$|€|spending|pension|isa|emergency fund)\b/.test(t)) return 'financial';
  if (/\b(business|startup|freelance|clients|revenue|sales|marketing|product|launch|company|side hustle|ecommerce|dropshipping|entrepreneur|agency|consulting|saas|app idea|monetise)\b/.test(t)) return 'business';
  if (/\b(learn|study|course|language|coding|programming|skill|certificate|fluent|speak|javascript|python|spanish|french|german|japanese|chinese|arabic|react|swift|kotlin|degree|qualification|exam)\b/.test(t)) return 'learning';
  if (/\b(job|career|promotion|interview|cv|resume|linkedin|role|position|manager|director|hired|apply|job search|new role|raise|pay rise|pivot|switch career)\b/.test(t)) return 'career';
  if (/\b(sleep|diet|nutrition|stress|anxiety|mental health|wellbeing|healthy|quit|smoking|alcohol|mindfulness|meditation|therapy|burnout|energy|fatigue|eating)\b/.test(t)) return 'health';
  if (/\b(write|writing|book|novel|music|song|art|draw|paint|design|publish|blog|podcast|creative|author|screenplay|comic|album|ep|exhibition)\b/.test(t)) return 'creative';

  return 'general';
}

const TEMPLATES: Record<GoalCategory, string> = {
  'fitness-muscle':      fitnessMuscleTpl,
  'fitness-weight-loss': fitnessWeightLossTpl,
  'fitness-sport':       fitnessSportTpl,
  financial:             financialTpl,
  business:              businessTpl,
  learning:              learningTpl,
  career:                careerTpl,
  health:                healthTpl,
  creative:              creativeTpl,
  general:               generalTpl,
};

export function getTemplate(category: GoalCategory): string {
  return TEMPLATES[category] ?? TEMPLATES.general;
}
