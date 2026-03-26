# GoalAchiever — AI-Powered Productivity App

An AI-powered mobile app that helps users achieve long-term goals through conversational goal setup, personalized roadmap generation, and adaptive task planning.

---

## What It Does

1. **Goal Setup** — User describes a goal in plain language. The AI refines it into a clear, specific statement and asks 3–5 clarifying questions about timeline, current situation, and constraints.
2. **Roadmap Generation** — Based on the answers, the AI generates a phased roadmap (2–3 phases) with weekly milestones and daily tasks for the first 7 days.
3. **Daily Task Management** — Users check off tasks each day. Tasks have priority levels, time estimates, and descriptions.
4. **Failure Analysis** — When a task isn't completed, the user explains why. The AI categorizes the failure, detects patterns, and reschedules or adjusts the task accordingly.
5. **Progress Analytics** — Tracks completion rates, failure patterns, and 7-day trends.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | Expo ~54.0.33 (React Native 0.81.5) |
| Language | TypeScript |
| Navigation | Expo Router + React Navigation (Bottom Tabs) |
| UI Components | React Native Paper |
| State Management | Zustand |
| Backend / Database | Supabase (PostgreSQL + RLS) |
| Authentication | Supabase Auth (email/password) |
| AI | Google Gemini 2.5 Flash API |
| Edge Functions | Deno (deployed on Supabase) |
| Session Storage | AsyncStorage |

---

## Project Structure

```
productivity-app/
├── app/                        # Screens (Expo Router file-based routing)
│   ├── auth.tsx                # Login / sign-up screen
│   ├── conversation.tsx        # AI conversation screen
│   ├── goal/
│   │   └── setup.tsx           # Goal setup flow (questions + answers)
│   └── tabs/
│       ├── index.tsx           # Home / Today screen
│       ├── analytics.tsx       # Progress & analytics screen
│       └── settings.tsx        # Settings & sign-out
├── services/
│   ├── aiService.ts            # Edge function calls (goal setup, roadmap, adjustment)
│   └── database/
│       ├── goals.ts            # Goal CRUD operations
│       └── tasks.ts            # Task CRUD + completion tracking
├── store/
│   ├── index.ts                # Global app store (Zustand)
│   ├── goalStore.ts            # Goal + roadmap state
│   ├── taskStore.ts            # Task state + DB sync
│   └── conversationStore.ts   # Goal setup conversation state
├── lib/
│   └── supabase.ts             # Supabase client (AsyncStorage session)
├── types/
│   └── index.ts                # All TypeScript interfaces
├── supabase/
│   ├── migrations/
│   │   └── 20260310000000_initial_schema.sql  # Full DB schema
│   └── functions/
│       ├── ai-goal-setup/      # Refines goal + returns clarifying questions
│       ├── ai-generate-roadmap/# Generates phases + daily tasks
│       └── ai-adjust-plan/     # Analyses failure + adjusts plan
└── .env                        # Supabase URL + anon key (local only)
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `goals` | User goals with status, timeline, and progress metrics |
| `roadmap_phases` | AI-generated phases with weekly milestones |
| `daily_tasks` | Individual tasks with scheduling, priority, and failure tracking |
| `task_failures` | Failure records used for AI pattern detection |
| `ai_conversations` | Full conversation history (goal setup + adjustments) |
| `progress_snapshots` | Daily analytics snapshots per goal |
| `user_settings` | Per-user preferences (notifications, theme, AI toggle) |

All tables have Row Level Security (RLS) — users can only access their own data.

---

## Edge Functions

### `ai-goal-setup`
- **Input**: `{ goalText: string }`
- **Output**: `{ redefinedGoal: string, questions: string[] }`
- Refines the user's raw goal into a clear statement and returns 3–5 clarifying questions.

### `ai-generate-roadmap`
- **Input**: `{ goalData: { goal, timelineMonths, context } }`
- **Output**: `{ success, goalId, roadmap }`
- Generates a phased roadmap and daily tasks for the first 7 days. Saves everything to the database.

### `ai-adjust-plan`
- **Input**: `{ taskId: string, failureReason: string }`
- **Output**: `{ analysis, pattern, category, adjustments, encouragement }`
- Analyses why a task failed, detects recurring patterns, and optionally reschedules or modifies the task.

---

## Setup

### Prerequisites
- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- Expo Go app on your phone
- Supabase account (free tier)
- Google Gemini API key (free tier — 1,500 requests/day)

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment** — create a `.env` file:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run the database migration** — paste `supabase/migrations/20260310000000_initial_schema.sql` into the Supabase SQL Editor and run it.

4. **Add the Gemini API key secret** — in Supabase → Edge Functions → Manage Secrets:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key

5. **Link and deploy edge functions**
   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase functions deploy ai-goal-setup
   npx supabase functions deploy ai-generate-roadmap
   npx supabase functions deploy ai-adjust-plan
   ```

6. **Start the app**
   ```bash
   npx expo start --clear
   ```

7. **Open on your phone** — scan the QR code with Expo Go

---

## Auth Flow

1. User signs up with email and password
2. Supabase sends a confirmation email — user must verify before logging in
3. On login, a session is stored in AsyncStorage (persists across restarts)
4. Tokens are automatically refreshed when they approach expiry
5. All edge function calls include the user's JWT as a Bearer token + anon key header

---

## State Management

| Store | Manages |
|---|---|
| `useAppStore` | Global UI state: loading, userId, demo mode |
| `useGoalStore` | Current goal and roadmap phases |
| `useTaskStore` | Today's tasks, upcoming tasks, task completion, failure submission |
| `useConversationStore` | Goal setup flow: goal text, AI questions, user answers |

---

## Cost

| Service | Cost |
|---|---|
| Supabase (free tier) | $0/month |
| Google Gemini API (free tier) | $0 (1,500 requests/day) |
| Expo Go (testing) | $0 |
| Apple Developer (App Store) | $99/year (when publishing) |
| Google Play (App Store) | $25 one-time (when publishing) |

---

## Platform Support

- iOS (via Expo Go / standalone build)
- Android (via Expo Go / standalone build)
