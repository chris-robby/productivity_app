# 🚀 Complete Setup Guide - Goal Achiever App

This guide will walk you through setting up the complete app from scratch. **Total time: ~30 minutes**

## ✅ Prerequisites Checklist

Before starting, make sure you have:
- [ ] Node.js 16+ installed ([download](https://nodejs.org/))
- [ ] A code editor (VS Code recommended)
- [ ] A smartphone (iPhone or Android) for testing
- [ ] Internet connection

## 📋 Step-by-Step Instructions

### STEP 1: Download the App Code (2 minutes)

1. Download the `productivity-app.zip` file
2. Extract it to your desired location
3. Open terminal/command prompt and navigate to the folder:
```bash
cd path/to/productivity-app
```

### STEP 2: Install Dependencies (5 minutes)

```bash
npm install
```

This will install all required packages. It may take a few minutes.

### STEP 3: Create Supabase Project (5 minutes)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" (create account if needed - it's free!)
3. Click "New Project"
   - **Name**: `productivity-app` (or your choice)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Select closest to you
4. Click "Create new project" and wait ~2 minutes for it to initialize

### STEP 4: Set Up Database (3 minutes)

1. Once your project is ready, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file `supabase/migrations/001_initial_schema.sql` from your downloaded code
4. Copy ALL the contents
5. Paste into the Supabase SQL Editor
6. Click "Run" (bottom right)
7. You should see "Success. No rows returned" - this is correct!

### STEP 5: Get Supabase Credentials (2 minutes)

1. In Supabase, click "Settings" (gear icon) in left sidebar
2. Click "API" in settings menu
3. You'll see two important values - **copy these now**:
   - **Project URL**: Looks like `https://xxxxx.supabase.co`
   - **anon public key**: Long string starting with `eyJ...`

### STEP 6: Configure App Environment (2 minutes)

1. In your code folder, duplicate `.env.example` and rename to `.env`
2. Open `.env` in your code editor
3. Replace the placeholders:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co  ← paste your Project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...  ← paste your anon public key
```
4. Save the file

### STEP 7: Get FREE Gemini API Key (3 minutes)

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Click "Create API Key in new project"
4. **IMPORTANT**: Copy the key immediately (looks like `AIzaSyC-xxxxx`)
5. Store it somewhere safe temporarily

### STEP 8: Add Gemini Key to Supabase (2 minutes)

1. Back in Supabase dashboard, go to "Project Settings" → "Edge Functions"
2. Scroll down to "Secrets" section
3. Click "Add new secret"
4. Enter:
   - **Name**: `GEMINI_API_KEY` (exactly like this!)
   - **Value**: Paste your Gemini API key
5. Click "Add secret"

### STEP 9: Install Supabase CLI (3 minutes)

```bash
npm install -g supabase
```

Then login:
```bash
npx supabase login
```

This will open a browser window - click "Authorize"

### STEP 10: Link Your Project (1 minute)

```bash
npx supabase link --project-ref YOUR_PROJECT_ID
```

**How to find YOUR_PROJECT_ID:**
- In Supabase, look at your Project URL: `https://YOUR_PROJECT_ID.supabase.co`
- Copy the part before `.supabase.co`

When prompted for database password, enter the one you created in Step 3.

### STEP 11: Deploy AI Functions (3 minutes)

Run these three commands:

```bash
npx supabase functions deploy ai-goal-setup
npx supabase functions deploy ai-generate-roadmap  
npx supabase functions deploy ai-adjust-plan
```

Each should show "Deployed successfully" ✅

### STEP 12: Run the App! (2 minutes)

```bash
npx expo start
```

You should see a QR code in your terminal!

### STEP 13: Test on Your Phone (1 minute)

**iPhone:**
1. Download "Expo Go" from App Store
2. Open Camera app and scan the QR code
3. App will open in Expo Go!

**Android:**
1. Download "Expo Go" from Google Play
2. Open Expo Go app
3. Tap "Scan QR code" and scan it
4. App will load!

## ✨ First Use

1. App opens → Tap "Sign Up"
2. Enter email and password
3. **Check your email** for confirmation link
4. Click the link in email
5. Return to app and Sign In
6. You'll see "What is your goal?" screen
7. Type your goal and start your journey! 🎯

## 🎉 You're Done!

The app is now running with:
- ✅ FREE Google Gemini AI
- ✅ Your own Supabase backend
- ✅ Complete goal tracking system
- ✅ AI-powered plan adjustments

## 🆘 Troubleshooting

### "No authorization header" error
- Make sure you confirmed your email and are signed in
- Check .env file has the correct Supabase credentials

### "Failed to get AI response"
- Verify `GEMINI_API_KEY` is correctly set in Supabase Secrets (Step 8)
- Check the exact name is `GEMINI_API_KEY` (case-sensitive!)

### App won't load
1. Stop the app (Ctrl+C)
2. Clear cache: `npx expo start -c`
3. Scan QR code again

### Edge Functions failed to deploy
- Make sure you're linked to the right project (`npx supabase link`)
- Check you're logged in (`npx supabase login`)

### Still having issues?
- Re-run `npm install`
- Delete `node_modules` folder and run `npm install` again
- Make sure Node.js version is 16 or higher: `node --version`

## 🔄 Daily Use

1. Open app each morning
2. See AI-generated tasks for today
3. Complete them (tap checkbox)
4. If you don't finish a task, AI will ask why
5. AI adjusts your plan based on your feedback
6. Track progress in Analytics tab

## 💡 Tips

- **Be honest with the AI** about why you didn't complete tasks
- **Check Analytics weekly** to see patterns
- **Set realistic goals** - the AI will help break them down
- **Morning routine** - check your tasks right after waking up

## 📱 Publishing to App Store (Later)

When you're ready to publish:
1. Apple App Store: Need $99/year Apple Developer account
2. Google Play: Need $25 one-time Google Developer account
3. Follow our [Deployment Guide](./DEPLOYMENT.md)

## 🔑 Important Notes

- **Gemini Free Tier**: 1,500 AI requests per day (plenty for personal use!)
- **Supabase Free Tier**: Good for ~50 daily users
- **Your Data**: Everything stays in YOUR Supabase - you own it!
- **Privacy**: API keys never exposed in the app code

---

**Need help?** Check the [main README](./README.md) or create an issue on GitHub.

**Enjoy building your goals!** 🚀
