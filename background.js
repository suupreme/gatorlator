// Background service worker for real-time speech-to-speech translation
// Pipeline: Audio Capture → Speaches.ai STT → Speaches.ai Translation → Speaches.ai TTS → Audio Playback

let audioContext = null;
let mediaStream = null;
let isRecording = false;
let audioMode = 'tab'; // 'tab' or 'mic'
let translationCache = new Map(); // Cache recent translations
let audioQueue = []; // Queue for TTS audio playback
let isPlayingAudio = false;

// Initialize on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Gatorlator Extension installed');
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    const mode = request.mode || 'tab';
    startAudioCapture(sender.tab.id, mode)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (request.action === 'stopCapture') {
    stopAudioCapture();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'getStatus') {
    sendResponse({ 
      isRecording, 
      hasStream: !!mediaStream,
      audioMode
    });
    return true;
  }
  
  if (request.action === 'setAudioMode') {
    audioMode = request.mode;
    sendResponse({ success: true });
    return true;
  }
  
  // Handle audio chunks from content script
  if (request.action === 'audioChunk') {
    processAudioChunk(request.data, request.sampleRate, request.isFinal);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'captureError') {
    console.error('Capture error from content script:', request.error);
    isRecording = false;
    sendResponse({ success: false });
    return true;
  }
});

// Start capturing audio from tab or mic
async function startAudioCapture(tabId, mode = 'tab') {
  if (isRecording) {
    console.log('Already recording');
    return;
  }
  
  audioMode = mode;
  isRecording = true;
  translationCache.clear();
  audioQueue = [];
  
  try {
    if (mode === 'tab') {
      // Tab audio capture - use chrome.tabCapture API
      if (!chrome.tabCapture || typeof chrome.tabCapture.capture !== 'function') {
        throw new Error('Tab capture API not available. Please ensure the extension has proper permissions.');
      }
      
      const streamId = await new Promise((resolve, reject) => {
        try {
          chrome.tabCapture.capture({
            audio: true,
            video: false
          }, (streamId) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (streamId) {
              resolve(streamId);
            } else {
              reject(new Error('Failed to capture tab audio. Make sure the tab is active and has audio playing.'));
            }
          });
        } catch (error) {
          reject(new Error(`Tab capture error: ${error.message}`));
        }
      });
      
      // Notify content script to start capture
      chrome.tabs.sendMessage(tabId, {
        action: 'startAudioCapture',
        streamId: streamId,
        mode: 'tab'
      });
    } else {
      // Mic audio capture
      chrome.tabs.sendMessage(tabId, {
        action: 'startAudioCapture',
        mode: 'mic'
      });
    }
    
    console.log(`Audio capture started (${mode} mode)`);
    
    chrome.tabs.sendMessage(tabId, {
      action: 'captureStarted',
      status: 'recording',
      mode: mode
    });
    
  } catch (error) {
    console.error('Error starting audio capture:', error);
    isRecording = false;
    throw error;
  }
}

// Process audio chunk with Speaches.ai
async function processAudioChunk(audioData, sampleRate, isFinal = false) {
  if (!isRecording) return;
  
  try {
    const settings = await getSettings();
    
    // Only process final transcripts for translation to avoid duplicates
    if (!isFinal) return;
    
    // Step 1: Speech-to-Text with Speaches.ai
    const transcript = await speachesTranscribe(audioData, sampleRate, settings);
    if (!transcript || transcript.trim().length === 0) return;
    
    // Step 2: Translation with Speaches.ai
    const translation = await speachesTranslate(transcript, settings);
    if (!translation) return;
    
    // Step 3: Send to content script for display
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'showSubtitle',
        original: transcript,
        translated: translation,
        timestamp: Date.now()
      });
    }
    
    // Step 4: Text-to-Speech with Speaches.ai
    if (settings.enableAudioOutput) {
      const audioUrl = await speachesTextToSpeech(translation, settings);
      if (audioUrl) {
        // Send audio to content script for playback
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'playAudio',
          audioUrl: audioUrl,
          text: translation
        });
      }
    }
    
    // Cache translation
    translationCache.set(transcript.toLowerCase(), translation);
    if (translationCache.size > 100) {
      const firstKey = translationCache.keys().next().value;
      translationCache.delete(firstKey);
    }
    
  } catch (error) {
    console.error('Error processing audio chunk:', error);
  }
}

// Speaches.ai Transcription (OpenAI Whisper-compatible)
async function speachesTranscribe(audioData, sampleRate, settings) {
  if (!settings.speachesApiKey && !settings.speachesApiUrl) {
    throw new Error('Speaches.ai API key or URL not configured');
  }
  
  try {
    // Convert to WAV format
    const wavBlob = audioBufferToWav([audioData], sampleRate);
    
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'text');
    
    // Use custom API URL if provided, otherwise default to speaches.ai
    const apiUrl = settings.speachesApiUrl || 'https://speaches.ai/v1/audio/transcriptions';
    const apiKey = settings.speachesApiKey || '';
    
    const headers = {
      'Authorization': `Bearer ${apiKey}`
    };
    
    // If using API key in query param (some setups prefer this)
    const url = apiKey ? `${apiUrl}?api_key=${apiKey}` : apiUrl;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: apiKey ? headers : {},
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Speaches.ai STT error: ${error}`);
    }
    
    const transcript = await response.text();
    return transcript.trim();
  } catch (error) {
    console.error('Speaches.ai transcription error:', error);
    return null;
  }
}

// Speaches.ai Translation
async function speachesTranslate(text, settings) {
  if (!settings.speachesApiKey && !settings.speachesApiUrl) {
    throw new Error('Speaches.ai API key or URL not configured');
  }
  
  // Check cache first
  const cacheKey = text.toLowerCase();
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  
  try {
    const targetLang = settings.targetLanguage || 'zh-CN';
    const langName = getLanguageName(targetLang);
    
    // Use OpenAI-compatible chat completion endpoint for translation
    const apiUrl = settings.speachesApiUrl || 'https://speaches.ai/v1/chat/completions';
    const apiKey = settings.speachesApiKey || '';
    
    const prompt = `Translate the following text from English to ${langName}.
Preserve technical terms and proper nouns.
Keep it natural and conversational.
Do not add any explanations, only return the translation.

Text: "${text}"`;

    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const url = apiKey ? `${apiUrl}?api_key=${apiKey}` : apiUrl;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: 'gpt-4o-mini', // or use settings.model if available
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Speaches.ai translation error: ${error.error?.message || JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    const translation = data.choices[0].message.content.trim();
    
    // Cache it
    translationCache.set(cacheKey, translation);
    
    return translation;
  } catch (error) {
    console.error('Speaches.ai translation error:', error);
    return null;
  }
}

// Speaches.ai Text-to-Speech
async function speachesTextToSpeech(text, settings) {
  if (!settings.speachesApiKey && !settings.speachesApiUrl) {
    return null;
  }
  
  try {
    const targetLang = settings.targetLanguage || 'zh-CN';
    
    // Use OpenAI-compatible TTS endpoint
    const apiUrl = settings.speachesApiUrl || 'https://speaches.ai/v1/audio/speech';
    const apiKey = settings.speachesApiKey || '';
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Map language to voice (you can customize this based on speaches.ai voice options)
    const langToVoice = {
      'zh-CN': 'alloy',
      'es': 'echo',
      'ja': 'fable',
      'ko': 'onyx',
      'fr': 'nova',
      'de': 'shimmer',
      'ru': 'alloy',
      'it': 'echo',
      'pt': 'fable',
      'hi': 'onyx',
      'ar': 'nova'
    };
    
    const voice = langToVoice[targetLang] || 'alloy';
    
    const url = apiKey ? `${apiUrl}?api_key=${apiKey}` : apiUrl;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Speaches.ai TTS error: ${error}`);
    }
    
    // Convert response to blob URL
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    return audioUrl;
  } catch (error) {
    console.error('Speaches.ai TTS error:', error);
    return null;
  }
}

// Helper: Get language name from code
function getLanguageName(langCode) {
  const langMap = {
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'es': 'Spanish',
    'hi': 'Hindi',
    'ar': 'Arabic',
    'pt': 'Portuguese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'fr': 'French',
    'de': 'German',
    'ru': 'Russian',
    'it': 'Italian',
    'nl': 'Dutch',
    'pl': 'Polish'
  };
  return langMap[langCode] || 'the target language';
}

// Convert Float32Array to 16-bit PCM
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Int16Array(buffer);
}

// Convert audio buffer to WAV format
function audioBufferToWav(buffer, sampleRate) {
  const length = buffer.reduce((sum, chunk) => sum + chunk.length, 0);
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
  const samples = new Int16Array(arrayBuffer, 44);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 0;
  for (const chunk of buffer) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      samples[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Stop audio capture
function stopAudioCapture() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  isRecording = false;
  translationCache.clear();
  audioQueue = [];
  
  // Clean up content script audio capture
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stopAudioCapture'
      });
    }
  });
  
  console.log('Audio capture stopped');
}

// Get settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'targetLanguage',
      'speachesApiKey',
      'speachesApiUrl',
      'enableAudioOutput',
      'model'
    ], (result) => {
      resolve({
        targetLanguage: result.targetLanguage || 'zh-CN',
        speachesApiKey: result.speachesApiKey || '',
        speachesApiUrl: result.speachesApiUrl || 'https://speaches.ai/v1',
        enableAudioOutput: result.enableAudioOutput !== false,
        model: result.model || 'gpt-4o-mini'
      });
    });
  });
}
