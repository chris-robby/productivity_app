# ⚡ Quick Reference Card

## Essential Commands

### Development
```bash
# Start the app
npx expo start

# Start with cache cleared
npx expo start -c

# Deploy Edge Functions
npx supabase functions deploy ai-goal-setup
npx supabase functions deploy ai-generate-roadmap
npx supabase functions deploy ai-adjust-plan
```

### Supabase
```bash
# Login to Supabase
npx supabase login

# Link your project
npx supabase link --project-ref YOUR_PROJECT_ID

# View function logs
npx supabase functions logs ai-goal-setup
```

## Important URLs

- **Supabase Dashboard**: https://app.supabase.com
- **Google AI Studio**: https://makersuite.google.com/app/apikey
- **Expo Dashboard**: https://expo.dev

## Environment Variables

Located in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Supabase Secrets

Set in Supabase Dashboard → Edge Functions → Secrets:
```
GEMINI_API_KEY=AIzaSyC-...
```

## Costs (Free Tier Limits)

- **Gemini AI**: 1,500 requests/day (FREE)
- **Supabase**: 500MB DB, 500K function calls/month (FREE)
- **Expo**: 30 builds/month for testing (FREE)

## Folder Structure

```
app/                 # All screens
  tabs/             # Main app screens (Home, Analytics, Settings)
  goal/             # Goal setup flow
  auth.tsx          # Login/Signup

services/           # Business logic
  ai/              # AI API calls
  database/        # Database operations
  supabase.ts      # Supabase client

supabase/
  functions/        # AI Edge Functions (backend)
  migrations/       # Database schema

store/             # Global state (Zustand)
types/             # TypeScript definitions
```

## Key Files

- `App.tsx` - Main entry point & navigation
- `.env` - Environment variables (YOUR credentials)
- `supabase/functions/*/index.ts` - AI integration (backend)
- `services/ai/aiService.ts` - AI communication (frontend)
- `supabase/migrations/001_initial_schema.sql` - Database structure

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| "No authorization header" | Make sure you're logged in, check .env |
| "Failed to get AI response" | Verify GEMINI_API_KEY in Supabase secrets |
| App won't start | Run `npx expo start -c` |
| Functions won't deploy | Run `npx supabase login` and `npx supabase link` |

## Testing Checklist

- [ ] Can sign up with email
- [ ] Receive confirmation email
- [ ] Can sign in
- [ ] Can start goal conversation
- [ ] AI responds to questions
- [ ] Roadmap generates successfully
- [ ] Today's tasks appear
- [ ] Can complete tasks
- [ ] Can mark tasks incomplete
- [ ] Analytics show data

## Next Steps

1. ✅ **Test thoroughly** with Expo Go
2. ⏭️ **Get Apple Developer account** ($99/year) when ready
3. ⏭️ **Build for TestFlight** using EAS Build
4. ⏭️ **Publish to App Store**

## Support Resources

- Expo Docs: https://docs.expo.dev
- Supabase Docs: https://supabase.com/docs
- React Native: https://reactnative.dev

---

**Keep this handy while developing!** 📌
