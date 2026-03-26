# Quick Start - GoalAchiever

Get the app running in 15 minutes!

## TL;DR

```bash
# 1. Install dependencies
npm install

# 2. Set up Supabase (see below)
# 3. Get Gemini API key (see below)
# 4. Configure .env file
# 5. Deploy backend

# 6. Run the app
npm start
# Scan QR code with Expo Go app
```

## Rapid Setup Checklist

### ☐ Step 1: Dependencies (2 min)
```bash
npm install
```

### ☐ Step 2: Supabase Account (5 min)

1. **Sign up**: [supabase.com](https://supabase.com) → "Start your project"
2. **Create project**: Name it, set password, wait 2 min
3. **Get credentials**: Settings → API
   - Copy **Project URL**
   - Copy **anon public key**

### ☐ Step 3: Environment Variables (1 min)

```bash
cp .env.example .env
```

Edit `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### ☐ Step 4: Database Setup (3 min)

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-ID
supabase db push
```

### ☐ Step 5: Gemini API (2 min)

1. Go to: [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Click "Get API Key" → "Create API key in new project"
3. Copy the key (AIzaSyC-xxxxx...)

### ☐ Step 6: Add Key to Supabase (1 min)

In Supabase Dashboard:
- Edge Functions → Secrets
- Add secret: `GEMINI_API_KEY` = (your key)

### ☐ Step 7: Deploy Functions (1 min)

```bash
supabase functions deploy ai-goal-setup
supabase functions deploy ai-generate-roadmap
supabase functions deploy ai-adjust-plan
```

### ☐ Step 8: Run App! (instant)

```bash
npm start
```

Scan QR with Expo Go app (iOS/Android)

## Test It Works

1. **Create account** in the app
2. **Verify email** (check spam folder)
3. **Login** to the app
4. **Set a goal**: Type "Learn React Native in 3 months"
5. **Answer AI questions** (2-3 questions)
6. **See your roadmap** 🎉

If you see the roadmap, everything works!

## Common Issues & Quick Fixes

### "Cannot connect to Supabase"
→ Check `.env` file has correct URL and key

### "Gemini API error"
→ Verify secret in Supabase: Edge Functions → Secrets

### "Database error"
→ Re-run: `supabase db push`

### QR won't scan
→ Try: `npm start --tunnel`

## What's Next?

- ✅ Read [README.md](./README.md) for full overview
- ✅ See [SETUP.md](./SETUP.md) for detailed instructions
- ✅ Check [DEPLOYMENT.md](./DEPLOYMENT.md) when ready to publish

## Full Documentation

| File | Purpose |
|------|---------|
| [README.md](./README.md) | Project overview & features |
| [SETUP.md](./SETUP.md) | Detailed setup guide |
| [GEMINI_SETUP.md](./GEMINI_SETUP.md) | Get Gemini API key |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy to app stores |

## Getting Help

Something not working?

1. Check error message
2. Review setup steps
3. Verify environment variables
4. Check Supabase dashboard for errors
5. Try `npm install` again

## Costs

**For beta testing: $0**
- Supabase free tier
- Gemini free tier  
- Expo free tier

**For production:**
- $99/year Apple Developer
- $25 one-time Google Play
- ~$50/month server costs (scales with users)

---

**Ready?** Run `npm start` and start achieving your goals! 🚀
