# 🐊🌍 Gatorlator - Live Lecture Translation

**AI lecture companion for international students** - Real-time translation subtitles for lecture videos, Zoom classes, and online courses.

## Features

- **Real-time Audio Capture** - Captures audio from browser tabs (YouTube, Coursera, Udemy, etc.)
- **Speech-to-Text** - Uses Deepgram for accurate lecture transcription
- **Smart Translation** - DeepL with context awareness
- **Hyper-Realistic-Text-to-Speech** - Uses Elevenlabs to output your preferred language
- **Live Subtitles** - Beautiful, customizable subtitle display
- **Glossary Mode** - Maintains consistent translations for technical terms
- **Context-Aware** - Remembers previous translations for better accuracy

## Installation

### Step 1: Download the Extension

1. Download the Zip file in the Releases
2. Extract the files to a folder (e.g., `gatorlator-extension`)

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
4. Select your `gatorlator-extension` folder
5. The extension icon should appear in your toolbar!

## Setup & Configuration

### 1. Get API Keys

#### Speech-to-Text

- **Deepgram** (Recommended)
  - Go to [Deepgram Console](https://console.deepgram.com/)
  - Create a new API key
  - Copy the key

#### Translation

- **DeepL** (Best Quality)
  - Sign up at [DeepL Pro API](https://www.deepl.com/pro-api)
  - Get your API key
  - Copy the key

### 2. Configure the Extension

1. Navigate to offscreen.js in the offscreen folder
2. Enter your API keys in the variables at the top of the file
3. Save the file

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

### Supported Platforms

- ✅ YouTube
- ✅ Coursera
- ✅ Udemy
- ✅ edX
- ✅ Any website with video content

## How It Works

```
Audio Capture → Speech-to-Text → Translation → Text-to-Speech → Subtitle Display
     ↓              ↓                ↓              ↓               ↓
  Tab Audio      Deepgram         DeepL           ElevenLabs     On-Screen
  (5s chunks)   (Accurate ASR)   (Context-aware) (Realistic TTS) Subtitles
```

### Processing Pipeline

1. **Audio Capture**: Captures audio from the browser tab in 5-second chunks
2. **Speech-to-Text**: Sends audio to Deepgram API for transcription
3. **Translation**: Translates the transcript using DeepL
4. **Text-to-Speech**: (Optional) Converts translated text to speech using ElevenLabs
5. **Display**: Shows translated subtitles on screen with smooth animations

### Context Awareness

The extension maintains context across translations:

- Remembers last 10 translations for better accuracy
- Glossary mode for consistent technical term translation

## Cost Considerations

### Free Tier Options

- **Web Speech API**: Free but less accurate (fallback only)
- **Free Google Translate**: Limited, less reliable

### Paid Options (Recommended)

- **Deepgram**: ~$0.0045 per minute of audio
- **DeepL**: ~$0.002 per 1,000 characters
- **ElevenLabs**: ~$0.18 per 1,000 characters

**Estimated cost for 1 hour lecture:**

- Speech-to-Text: ~$0.27 (Deepgram)
- Translation: ~$0.10-0.50 (depending on language)
- Text-to-Speech: ~$0.90 (ElevenLabs)
- **Total: ~$1.27 - $1.67 per hour**

## Privacy & Ethics

- ✅ **No audio storage** - Audio is processed in real-time and discarded
- ✅ **Local processing** - Audio chunks processed immediately
- ✅ **No content redistribution** - Translations only shown to you
- ✅ **Accessibility focus** - Designed as learning support tool

**Note**: Some universities may restrict recording lectures. Always check your institution's policies.

## Development

### Key Technologies

- **Chrome Extension Manifest V3**
- **Web Audio API** - Audio capture and processing
- **Deepgram API** - Speech recognition
- **DeepL API** - Translation
- **ElevenLabs API** - Text-to-Speech
- **Chrome Tab Capture API** - Tab audio capture

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
