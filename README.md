# 🌍 Gatorlater - Live Lecture Translation

**AI lecture companion for international students** - Real-time translation subtitles for lecture videos, Zoom classes, and online courses.

## Features

- 🎤 **Real-time Audio Capture** - Captures audio from browser tabs (YouTube, Coursera, Udemy, etc.)
- 🗣️ **Speech-to-Text** - Uses OpenAI Whisper for accurate lecture transcription
- 🌐 **Smart Translation** - DeepL or Google Translate with context awareness
- 📝 **Live Subtitles** - Beautiful, customizable subtitle display
- ⏪ **Replay & Repeat** - Keyboard shortcuts for better learning
- 📚 **Glossary Mode** - Maintains consistent translations for technical terms
- 🎯 **Context-Aware** - Remembers previous translations for better accuracy

## Installation

### Step 1: Download the Extension

1. Download or clone this repository
2. Extract the files to a folder (e.g., `gatorlater-extension`)

### Step 2: Create Icon Files (Optional)

Create three icon files in the extension folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can use any image editor or download placeholder icons. The extension will work without them, but Chrome may show a warning.

### Step 3: Install in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select your `gatorlater-extension` folder
5. The extension icon should appear in your toolbar!

## Setup & Configuration

### 1. Get API Keys

#### Speech-to-Text (Required)
- **OpenAI Whisper** (Recommended)
  - Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
  - Create a new API key
  - Copy the key (starts with `sk-`)

#### Translation (Choose One)
- **DeepL** (Best Quality)
  - Sign up at [DeepL Pro API](https://www.deepl.com/pro-api)
  - Get your API key
  - Copy the key

- **Google Translate API** (Alternative)
  - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  - Enable Translation API
  - Create credentials
  - Copy the API key

- **Free Translation** (Limited, No API Key)
  - Less reliable but works without setup
  - Enable in Settings tab

### 2. Configure the Extension

1. Click the Gatorlater extension icon in your toolbar
2. Go to the **Settings** tab
3. Enter your API keys:
   - OpenAI API Key (for speech-to-text)
   - DeepL or Google Translate API Key (for translation)
4. Click **Save Settings**

### 3. Select Your Language

1. In the **Main** tab, select your target language
2. Toggle **Enable Subtitles** on
3. Click **Start Translation**

## Usage

### Basic Usage

1. **Open a lecture video** (YouTube, Coursera, Udemy, etc.)
2. **Click the extension icon**
3. **Select your language** and click **Start Translation**
4. **Subtitles will appear** at the bottom of the video as the lecture plays

### Keyboard Shortcuts

- **R** - Replay last 10 seconds
- **T** - Toggle subtitles on/off
- **P** - Pause video and repeat last sentence

### Supported Platforms

- ✅ YouTube
- ✅ Coursera
- ✅ Udemy
- ✅ edX
- ✅ Any website with video content

## How It Works

```
Audio Capture → Speech-to-Text → Translation → Subtitle Display
     ↓              ↓                ↓              ↓
  Tab Audio    OpenAI Whisper    DeepL/Google    On-Screen
  (5s chunks)   (Accurate ASR)   (Context-aware)  Subtitles
```

### Processing Pipeline

1. **Audio Capture**: Captures audio from the browser tab in 5-second chunks
2. **Speech-to-Text**: Sends audio to OpenAI Whisper API for transcription
3. **Translation**: Translates the transcript using DeepL or Google Translate
4. **Display**: Shows translated subtitles on screen with smooth animations

### Context Awareness

The extension maintains context across translations:
- Remembers last 10 translations for better accuracy
- Glossary mode for consistent technical term translation
- Adjustable delay (5-10 seconds) for better accuracy vs. speed

## Cost Considerations

### Free Tier Options
- **Web Speech API**: Free but less accurate (fallback only)
- **Free Google Translate**: Limited, less reliable

### Paid Options (Recommended)
- **OpenAI Whisper**: ~$0.006 per minute of audio
- **DeepL**: ~$0.002 per 1,000 characters
- **Google Translate**: ~$20 per 1M characters

**Estimated cost for 1 hour lecture:**
- Speech-to-Text: ~$0.36 (Whisper)
- Translation: ~$0.10-0.50 (depending on language)
- **Total: ~$0.50 per hour**

## Privacy & Ethics

- ✅ **No audio storage** - Audio is processed in real-time and discarded
- ✅ **Local processing** - Audio chunks processed immediately
- ✅ **No content redistribution** - Translations only shown to you
- ✅ **Accessibility focus** - Designed as learning support tool

**Note**: Some universities may restrict recording lectures. Always check your institution's policies.

## Troubleshooting

### "Failed to capture tab audio"
- Make sure the video tab is **active** (clicked on)
- Refresh the page and try again
- Check that the video is playing

### "No speech-to-text service configured"
- Go to Settings tab
- Enter your OpenAI API key
- Or enable "Use Web Speech API" (less accurate)

### "No translation service configured"
- Go to Settings tab
- Enter DeepL or Google Translate API key
- Or enable "Use Free Translation"

### Subtitles not appearing
- Check that subtitles are enabled (toggle in popup)
- Make sure the video is playing
- Try refreshing the page

### API Errors
- Verify your API keys are correct
- Check your API quota/balance
- For OpenAI: Check [usage dashboard](https://platform.openai.com/usage)
- For DeepL: Check [account status](https://www.deepl.com/pro-account)

## Development

### Project Structure

```
gatorlater-extension/
├── manifest.json       # Extension configuration
├── background.js       # Service worker (audio processing)
├── content.js          # Content script (subtitle display)
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── styles.css          # Subtitle styling
└── README.md           # This file
```

### Key Technologies

- **Chrome Extension Manifest V3**
- **Web Audio API** - Audio capture and processing
- **OpenAI Whisper API** - Speech recognition
- **DeepL/Google Translate API** - Translation
- **Chrome Tab Capture API** - Tab audio capture

## Future Features

- [ ] Text-to-Speech output (AI voices)
- [ ] Mobile app version
- [ ] Zoom integration
- [ ] Professor-specific tuning
- [ ] Export transcriptions
- [ ] Multi-language support (detect source language)
- [ ] Offline mode (local processing)

## Contributing

This is an MVP. Contributions welcome! Areas for improvement:
- Better error handling
- Offline speech recognition
- More translation providers
- UI/UX improvements
- Performance optimization

## License

MIT License - Feel free to use and modify for educational purposes.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Chrome extension console for errors
3. Verify API keys and quotas

---

**Made for international students who want to learn without language barriers** 🌍📚
