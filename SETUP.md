# Setup Guide - GoalAchiever App

Complete step-by-step guide to get the app running on your phone.

## Prerequisites

Before you begin, make sure you have:
- ✅ A computer (Mac, Windows, or Linux)
- ✅ Node.js 18+ installed ([Download here](https://nodejs.org/))
- ✅ A smartphone (iOS or Android) for testing
- ✅ Internet connection

## Step 1: Install Dependencies (5 minutes)

```bash
# Navigate to project folder
cd productivity-app

# Install all dependencies
npm install

# This will install:
# - Expo and React Native
# - Supabase client
# - All other dependencies
```

Wait for installation to complete (may take 2-5 minutes).

## Step 2: Create Supabase Project (10 minutes)

### 2.1 Sign Up for Supabase

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub or email (it's FREE)

### 2.2 Create New Project

1. Click "New Project"
2. Fill in details:
   - **Name**: `productivity-app` (or anything you like)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
   - **Plan**: Free tier is perfect
3. Click "Create new project"
4. Wait 2-3 minutes for project to initialize

### 2.3 Get Your Project Credentials

1. In Supabase dashboard, go to **Settings** (⚙️ icon)
2. Click **API** in sidebar
3. You'll see:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (long string)
   - **service_role key**: `eyJhbGc...` (another long string - keep secret!)

**IMPORTANT**: Copy these values - you'll need them next!

## Step 3: Configure Environment Variables (2 minutes)

1. In project root, copy the example file:
```bash
cp .env.example .env
```

2. Open `.env` file in a text editor

3. Replace the values:
```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Save the file

**✅ Checkpoint**: Your `.env` file should have real values, not placeholders.

## Step 4: Set Up Database (5 minutes)

### 4.1 Install Supabase CLI

```bash
npm install -g supabase
```

### 4.2 Link to Your Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR-PROJECT-ID
```

Replace `YOUR-PROJECT-ID` with the ID from your project URL.

### 4.3 Run Database Migration

```bash
# This creates all database tables
supabase db push
```

You should see: "✅ Database migrations applied successfully"

## Step 5: Get Google Gemini API Key (5 minutes)

See [GEMINI_SETUP.md](./GEMINI_SETUP.md) for detailed instructions.

**Quick version:**
1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Click "Create API Key in new project"
4. Copy the key (looks like: `AIzaSyC-xxxxx...`)

**This is FREE!** No credit card needed.

## Step 6: Configure Gemini API in Supabase (3 minutes)

### 6.1 Add Secret to Supabase

1. Go to Supabase dashboard
2. Click **Edge Functions** (⚡ icon)
3. Scroll to **Secrets**
4. Click "Add new secret"
5. Add:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: (paste your Gemini API key)
6. Click "Save"

### 6.2 Deploy Edge Functions

```bash
# Deploy all three Edge Functions
supabase functions deploy ai-goal-setup
supabase functions deploy ai-generate-roadmap
supabase functions deploy ai-adjust-plan
```

Each deployment should show: "✅ Deployed successfully"

## Step 7: Test the App (2 minutes)

### 7.1 Start Development Server

```bash
npm start
```

You'll see a QR code in your terminal.

### 7.2 Install Expo Go on Your Phone

- **iOS**: Download [Expo Go](https://apps.apple.com/app/expo-go/id982107779) from App Store
- **Android**: Download [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) from Play Store

### 7.3 Scan QR Code

- **iOS**: Open Camera app → Point at QR code
- **Android**: Open Expo Go → Scan QR code

The app will load on your phone in ~30 seconds!

## Step 8: Create Your Account

1. App opens to login screen
2. Tap "Sign Up"
3. Enter email and password
4. Check your email for verification link (check spam!)
5. Click verification link
6. Return to app and login

**🎉 Success!** You should now see the "What is your goal?" screen.

## Troubleshooting

### Issue: "Failed to fetch" error

**Solution**: Check your `.env` file has correct Supabase URL and keys.

```bash
# Verify .env file
cat .env
```

### Issue: "Gemini API error"

**Solution**: 
1. Verify API key is correct in Supabase Secrets
2. Make sure Edge Functions are deployed
3. Check Gemini API quota at [console.cloud.google.com](https://console.cloud.google.com)

### Issue: QR code won't scan

**Solution**:
1. Make sure phone and computer are on same WiFi
2. Try typing the URL manually in Expo Go
3. Try `npm start --tunnel` for slower but more reliable connection

### Issue: Database errors

**Solution**: Re-run the migration:
```bash
supabase db reset
supabase db push
```

### Issue: Can't login after signup

**Solution**: Check email for verification link. If not received:
```bash
# Check Supabase dashboard → Authentication → Users
# Manually verify user if needed
```

## Next Steps

Once everything is working:

1. **Test goal setup**: Try creating a goal
2. **Complete a task**: Check off a task when done
3. **View analytics**: See your progress
4. **Test failure flow**: Skip a task and provide reason

## Advanced Configuration (Optional)

### Enable Notifications

See Expo notifications docs: [docs.expo.dev/push-notifications](https://docs.expo.dev/push-notifications/)

### Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios --profile preview

# Build for Android
eas build --platform android --profile preview
```

## Getting Help

If you run into issues:

1. Check error messages carefully
2. Verify all environment variables are set
3. Check Supabase dashboard for error logs
4. Review [README.md](./README.md) for common issues

## Summary Checklist

- ✅ Node.js installed
- ✅ Dependencies installed (`npm install`)
- ✅ Supabase project created
- ✅ `.env` file configured
- ✅ Database migrated
- ✅ Gemini API key obtained
- ✅ Edge Functions deployed
- ✅ App running on phone
- ✅ Account created

**Estimated total time: 30-40 minutes**

## What's Next?

Your app is now fully functional! You can:

- Use it daily to achieve your goals
- Share with friends for beta testing
- Customize the UI
- Add new features
- Deploy to App Store/Play Store when ready

Enjoy achieving your goals! 🎯
