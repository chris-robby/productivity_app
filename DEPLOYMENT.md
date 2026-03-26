# Deployment Guide

How to deploy GoalAchiever to production (App Store & Play Store).

## Prerequisites

Before deploying:
- ✅ App tested thoroughly on TestFlight/Internal testing
- ✅ All features working
- ✅ User feedback incorporated
- ✅ No critical bugs

## Step 1: Prepare for Production

### 1.1 Update App Configuration

Edit `app.json`:

```json
{
  "expo": {
    "name": "GoalAchiever",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourcompany.goalachiever",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.yourcompany.goalachiever",
      "versionCode": 1
    }
  }
}
```

Replace `yourcompany` with your actual company/developer name.

### 1.2 Update Environment for Production

Create `.env.production`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

## Step 2: Set Up Developer Accounts

### Apple Developer Account ($99/year)

1. Go to [developer.apple.com](https://developer.apple.com)
2. Enroll in Apple Developer Program
3. Pay $99 annual fee
4. Wait for approval (~24 hours)

### Google Play Developer ($25 one-time)

1. Go to [play.google.com/console](https://play.google.com/console)
2. Create developer account
3. Pay $25 one-time fee
4. Account active immediately

## Step 3: Install EAS CLI

```bash
npm install -g eas-cli

# Login to your Expo account
eas login
```

## Step 4: Configure EAS Build

```bash
# Initialize EAS in your project
eas build:configure
```

This creates `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "YOUR_PRODUCTION_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "YOUR_PRODUCTION_KEY"
      }
    }
  }
}
```

## Step 5: Build for iOS

### 5.1 Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - **Platform**: iOS
   - **Name**: GoalAchiever
   - **Primary Language**: English
   - **Bundle ID**: (select the one you created)
   - **SKU**: goalachiever-ios
4. Click "Create"

### 5.2 Build iOS App

```bash
# Build for App Store
eas build --platform ios --profile production

# This will:
# - Ask for Apple credentials
# - Generate certificates
# - Build the app
# - Take ~15-20 minutes
```

### 5.3 Submit to App Store

```bash
# Submit to App Store Connect
eas submit --platform ios --profile production
```

Then in App Store Connect:
1. Add screenshots (required)
2. Write app description
3. Set pricing (Free)
4. Submit for review
5. Wait 1-3 days for Apple review

## Step 6: Build for Android

### 6.1 Create App in Play Console

1. Go to [play.google.com/console](https://play.google.com/console)
2. Click "Create app"
3. Fill in:
   - **App name**: GoalAchiever
   - **Default language**: English
   - **App or game**: App
   - **Free or paid**: Free
4. Complete all declarations

### 6.2 Build Android App

```bash
# Build for Play Store
eas build --platform android --profile production

# Takes ~10-15 minutes
```

### 6.3 Submit to Play Store

```bash
# Submit to Play Store
eas submit --platform android --profile production
```

Then in Play Console:
1. Add screenshots
2. Write description
3. Set content rating
4. Fill in privacy policy
5. Submit for review
6. Wait 1-3 days for Google review

## Step 7: App Store Assets

### Screenshots Required

**iOS:**
- 6.7" iPhone (1290 x 2796) - at least 3 screenshots
- 6.5" iPhone (1284 x 2778) - at least 3 screenshots
- 5.5" iPhone (1242 x 2208) - at least 3 screenshots

**Android:**
- Phone (16:9 aspect ratio) - at least 2 screenshots
- 7-inch tablet (optional)
- 10-inch tablet (optional)

### Icon

- **Size**: 1024 x 1024 pixels
- **Format**: PNG
- **No transparency**
- **No rounded corners** (iOS adds them automatically)

### App Description Template

```
📱 GoalAchiever - Your AI-Powered Success Coach

Achieve your biggest goals with personalized roadmaps created by AI. 
GoalAchiever breaks down ambitious goals into daily actionable tasks 
and adapts your plan based on your progress.

🎯 FEATURES:

• Conversational Goal Setup
  Tell our AI what you want to achieve - it asks the right questions 
  to create your perfect plan

• Personalized Roadmaps
  AI generates month-by-month strategies tailored to your situation

• Daily Tasks
  Clear, actionable tasks broken down from your big goal

• Smart Adaptation
  AI learns from your progress and adjusts your plan automatically

• Progress Analytics
  Track completion rates, identify patterns, stay motivated

🚀 HOW IT WORKS:

1. Tell us your goal (e.g., "Get promoted in 6 months")
2. Answer a few clarifying questions
3. Get your personalized roadmap
4. Complete daily tasks
5. AI adjusts based on your feedback
6. Achieve your goal!

💡 PERFECT FOR:

• Career advancement
• Learning new skills
• Fitness goals
• Business launches
• Personal projects
• Any ambitious goal

🆓 FREE BETA:
Start your journey today at no cost!

Terms: [your-website]/terms
Privacy: [your-website]/privacy
```

## Step 8: Post-Launch

### Monitor Crashes

```bash
# View crash reports
eas build:list
```

### Update App

When you need to update:

```bash
# Increment version in app.json
# Then build again
eas build --platform all --profile production

# Submit updates
eas submit --platform all --profile production
```

### OTA Updates (For Small Changes)

For minor updates that don't need app store review:

```bash
eas update --branch production --message "Bug fixes"
```

## Costs Summary

### One-Time
- Apple Developer: $99/year
- Google Play: $25 one-time

### Monthly (Production)
- Supabase: $0-25/month (depends on usage)
- Gemini API: $0-50/month (depends on users)
- EAS Build: $0-29/month (free tier usually enough)

### Total First Year
- ~$150-300 setup
- ~$50-150/month running costs

## Marketing Checklist

After launch:
- [ ] Create landing page
- [ ] Set up social media
- [ ] Write launch blog post
- [ ] Share on Product Hunt
- [ ] Post in relevant communities
- [ ] Reach out to beta testers
- [ ] Ask for reviews

## App Store Optimization

### Keywords to Target
- Goal setting
- Productivity
- AI planner
- Task manager
- Goal tracker
- Success coach

### Review Strategy
- Ask satisfied users for reviews
- Respond to all reviews
- Fix issues quickly
- Maintain 4+ star rating

## Success Metrics to Track

- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Goal completion rate
- User retention (D1, D7, D30)
- App Store rating
- Crash-free rate

## Getting Help

- **EAS Build Issues**: [docs.expo.dev/build](https://docs.expo.dev/build)
- **App Store Rejection**: Review Apple's guidelines
- **Play Store Issues**: Check Play Console notifications
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)

Congratulations on launching! 🎉
