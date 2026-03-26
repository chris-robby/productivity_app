# Google Gemini API Setup Guide

This guide shows you how to get a FREE Google Gemini API key for the GoalAchiever app.

## What is Google Gemini?

Google Gemini is Google's AI model (similar to ChatGPT or Claude). We're using the **Gemini 1.5 Flash** model which is:
- ✅ **Completely FREE** for reasonable usage
- ✅ **Fast** responses (good UX)
- ✅ **1,500 requests per day** on free tier
- ✅ **No credit card required** initially

Perfect for beta testing and personal use!

## Step-by-Step Instructions

### Step 1: Go to Google AI Studio

Open your browser and go to:
**[makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)**

### Step 2: Sign In

- Sign in with your Google account
- If you don't have one, create a free Google account first

### Step 3: Create API Key

1. Click the **"Get API Key"** button (blue button)
2. You'll see two options:
   - "Create API key in new project" ← **Choose this one**
   - "Create API key in existing project"
3. Click **"Create API key in new project"**

### Step 4: Copy Your API Key

You'll see your API key displayed. It looks like:
```
AIzaSyC-xxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**IMPORTANT**: 
- Click the **copy** icon to copy it
- Paste it somewhere safe (you'll need it in a minute)
- **Never share this key publicly!**

### Step 5: Understanding Free Tier Limits

Your free tier includes:

**Gemini 1.5 Flash:**
- ✅ 1,500 requests per day
- ✅ 15 requests per minute
- ✅ 1 million tokens per minute
- ✅ FREE forever (as of March 2026)

**For our app, this means:**
- ~50 users can use the app daily
- Each user can set up goals and get adjustments
- More than enough for beta testing!

### Step 6: Add Key to Supabase

Now we need to securely store this key in Supabase:

1. **Open Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Click on your project

2. **Navigate to Edge Functions**
   - Click the **Edge Functions** icon (⚡) in sidebar
   - Scroll down to **"Secrets"** section

3. **Add New Secret**
   - Click **"Add new secret"**
   - Name: `GEMINI_API_KEY`
   - Value: (paste your API key)
   - Click **"Save"**

### Step 7: Verify It's Working

After deploying Edge Functions (see SETUP.md), test the API:

1. Open the app on your phone
2. Create an account
3. Start setting up a goal
4. If the AI responds, it's working! ✅

## Monitoring Usage

To check how many requests you've made:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project
3. Navigate to **"APIs & Services"** → **"Dashboard"**
4. Look for **"Generative Language API"**
5. Click it to see usage stats

## Troubleshooting

### "API key invalid" error

**Solutions:**
- Double-check you copied the entire key (no spaces)
- Make sure you added it to Supabase Secrets as `GEMINI_API_KEY`
- Try creating a new API key

### "Quota exceeded" error

**This means you've hit the free tier limit.**

Options:
1. Wait for quota to reset (daily at midnight UTC)
2. Enable billing in Google Cloud (pay-as-you-go)
3. Create new project with new API key (not recommended)

### "Gemini API not enabled"

**Solution:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project
3. Search for "Generative Language API"
4. Click "Enable"

## Cost Breakdown

### Free Tier (Current)
```
Daily requests: 1,500 FREE
Cost: $0/month
```

### If You Exceed Free Tier

Gemini 1.5 Flash pricing (as of March 2026):
- **Input**: $0.00035 per 1,000 tokens
- **Output**: $0.00105 per 1,000 tokens

**Example**: 
- 10,000 requests/month
- Average 500 tokens per request
- **Cost**: ~$3-5/month

Still very cheap!

## Switching to Claude Later

The app is designed to easily switch AI providers:

```typescript
// In Edge Function, just change these lines:
// FROM:
const geminiResponse = await fetch('gemini-api-url', {...});

// TO:
const claudeResponse = await fetch('claude-api-url', {...});
```

Takes ~5 minutes to switch!

## Security Best Practices

✅ **DO:**
- Store API key in Supabase Secrets
- Use environment variables
- Monitor usage regularly

❌ **DON'T:**
- Put API key in mobile app code
- Commit API key to Git
- Share API key publicly
- Use same key for multiple projects

## API Key Management

### Rotating Your Key

If you need to change your API key:

1. Create new key in Google AI Studio
2. Update Supabase Secret
3. Old key will stop working immediately

### Restricting Access

To limit what your key can do:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Navigate to **"Credentials"**
3. Click on your API key
4. Set **"Application restrictions"**
5. Set **"API restrictions"** to only "Generative Language API"

## Frequently Asked Questions

### Q: Is it really free?
**A:** Yes! Google offers 1,500 free requests/day on Gemini 1.5 Flash.

### Q: Do I need a credit card?
**A:** No for free tier. Only if you want to exceed limits.

### Q: Will I be charged automatically?
**A:** No. Billing must be explicitly enabled.

### Q: How long does the key last?
**A:** Forever (unless you delete it or the project).

### Q: Can I use the same key for multiple apps?
**A:** Technically yes, but not recommended for security.

## Next Steps

Once you have your Gemini API key:

1. ✅ Add it to Supabase Secrets
2. ✅ Deploy Edge Functions
3. ✅ Test the app
4. ✅ Start achieving your goals!

## Additional Resources

- **Gemini API Docs**: [ai.google.dev/docs](https://ai.google.dev/docs)
- **Pricing**: [ai.google.dev/pricing](https://ai.google.dev/pricing)
- **Google Cloud Console**: [console.cloud.google.com](https://console.cloud.google.com)

---

**Having trouble?** Check the main [SETUP.md](./SETUP.md) guide or create an issue in the repository.
