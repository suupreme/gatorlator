# Quick Setup Guide

## 5-Minute Setup

### 1. Install Extension (2 minutes)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `swamphack` folder
5. Done! Extension is installed ✅

### 2. Get API Keys (3 minutes)

#### Option A: Full Setup (Recommended)

**OpenAI API Key** (for speech recognition):
1. Go to https://platform.openai.com/api-keys
2. Sign up/login
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

**DeepL API Key** (for translation):
1. Go to https://www.deepl.com/pro-api
2. Sign up for free tier (500k chars/month free)
3. Get your API key
4. Copy the key

#### Option B: Quick Start (Free, Less Accurate)

1. Open extension popup
2. Go to **Settings** tab
3. Enable "Use Web Speech API" (for speech-to-text)
4. Enable "Use Free Translation" (for translation)
5. Click **Save Settings**

**Note**: Free options are less accurate but work immediately!

### 3. Configure Extension

1. Click the extension icon
2. Go to **Settings** tab
3. Paste your API keys:
   - OpenAI API Key → Speech-to-Text field
   - DeepL API Key → Translation field
4. Click **Save Settings**

### 4. Start Using!

1. Open any YouTube lecture video
2. Click extension icon
3. Select your language (e.g., 中文 for Chinese)
4. Click **Start Translation**
5. Subtitles appear automatically! 🎉

## Testing

Try it on:
- YouTube: https://www.youtube.com/watch?v=dQw4w9WgXcQ
- Any Coursera/Udemy lecture
- Any video with spoken content

## Troubleshooting

**"Failed to capture tab audio"**
→ Make sure the video tab is active (clicked on)

**"No API key configured"**
→ Go to Settings tab and add your keys

**Subtitles not showing**
→ Check that video is playing and subtitles are enabled

## Cost Estimate

- **Free tier**: Web Speech API + Free Google Translate (limited accuracy)
- **Paid**: ~$0.50 per hour of lecture (Whisper + DeepL)

For students: Free tier works for testing, paid is recommended for actual use.

---

**Ready to go!** Open a lecture video and click "Start Translation" 🚀
