// Background service worker for audio processing pipeline
// Handles: Audio Capture → Speech-to-Text → Translation → Subtitle Display

let audioContext = null;
let mediaStream = null;
let processor = null;
let isRecording = false;
let audioBuffer = [];
let bufferDuration = 5000; // 5 seconds of audio before processing
let lastProcessTime = 0;
let translationContext = []; // Maintain context for better translations
let glossary = new Map(); // Store technical terms for consistent translation

// Initialize on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Luma Translation Extension installed');
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    startAudioCapture(sender.tab.id)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
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
      bufferSize: audioBuffer.length 
    });
    return true;
  }
  
  if (request.action === 'addGlossaryTerm') {
    glossary.set(request.term, request.translation);
    sendResponse({ success: true });
    return true;
  }
  
  // Handle audio chunks from content script
  if (request.action === 'audioChunk') {
    // Convert Float32Array data back to audio buffer
    const audioData = new Float32Array(request.data);
    audioBuffer.push(audioData);
    
    // Store sample rate for WAV conversion
    if (!audioContext) {
      audioContext = { sampleRate: request.sampleRate || 44100 };
    }
    
    // Process if enough time has passed
    const currentTime = Date.now();
    if (currentTime - lastProcessTime >= bufferDuration) {
      processAudioChunk();
      lastProcessTime = currentTime;
    }
    
    isRecording = true; // Mark as recording when we receive chunks
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

// Start capturing audio from the current tab
async function startAudioCapture(tabId) {
  if (isRecording) {
    console.log('Already recording');
    return;
  }
  
  try {
    // Request tab capture - returns a streamId
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({
        audio: true,
        video: false
      }, (streamId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (streamId) {
          resolve(streamId);
        } else {
          reject(new Error('Failed to capture tab audio. Make sure the tab is active.'));
        }
      });
    });
    
    // In service worker context, we need to use chrome.tabCapture.getStream
    // However, this requires the stream to be consumed in a different context
    // For now, we'll inject a content script to handle audio capture
    // This is a workaround for service worker limitations
    
    // Mark as recording and notify content script to start capture
    isRecording = true;
    audioBuffer = [];
    lastProcessTime = Date.now();
    
    // Inject audio capture script into the tab
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: captureTabAudio,
        args: [streamId]
      });
    } catch (error) {
      console.error('Error injecting script:', error);
      // Fallback: send message to content script
      chrome.tabs.sendMessage(tabId, {
        action: 'startAudioCapture',
        streamId: streamId
      });
    }
    
    console.log('Audio capture started');
    
    // Notify content script
    chrome.tabs.sendMessage(tabId, {
      action: 'captureStarted',
      status: 'recording'
    });
    
    // Alternative: Use chrome.tabCapture.getStream (if available)
    // Note: This may require additional setup
    try {
      chrome.tabCapture.getStream(streamId, (stream) => {
        if (chrome.runtime.lastError) {
          console.error('getStream error:', chrome.runtime.lastError);
          // Fallback to content script approach
          return;
        }
        if (stream) {
          setupAudioProcessing(stream, tabId);
        }
      });
    } catch (e) {
      console.log('Using content script approach for audio capture');
    }
    
  } catch (error) {
    console.error('Error starting audio capture:', error);
    throw error;
  }
}

// Function to be injected into content script for audio capture
function captureTabAudio(streamId) {
  // This function runs in the page context
  navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  }).then(stream => {
    // Send audio data to background script
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    let audioChunks = [];
    let lastSend = Date.now();
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      audioChunks.push(new Float32Array(inputData));
      
      // Send chunks every 5 seconds
      if (Date.now() - lastSend >= 5000 && audioChunks.length > 0) {
        const audioData = audioChunks.flat();
        chrome.runtime.sendMessage({
          action: 'audioChunk',
          data: Array.from(audioData),
          sampleRate: audioContext.sampleRate
        });
        audioChunks = [];
        lastSend = Date.now();
      }
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    // Store reference for cleanup
    window.__lumaAudioCapture = { stream, audioContext, processor };
  }).catch(err => {
    console.error('Error in audio capture:', err);
    chrome.runtime.sendMessage({
      action: 'captureError',
      error: err.message
    });
  });
}

// Setup audio processing from stream
function setupAudioProcessing(stream, tabId) {
  // This would work if getStream is available
  // For now, we use the content script approach above
  mediaStream = stream;
  
  // Note: AudioContext is not available in service workers
  // We need to process audio in content script or use Web Audio Worklet
  console.log('Stream received, processing via content script');
}

// Process accumulated audio chunk
async function processAudioChunk() {
  if (audioBuffer.length === 0) return;
  
  // Convert audio buffer to WAV format for API
  const wavBlob = audioBufferToWav(audioBuffer);
  audioBuffer = []; // Clear buffer
  
  try {
    // Step 1: Speech-to-Text
    const transcript = await speechToText(wavBlob);
    if (!transcript || transcript.trim().length === 0) return;
    
    // Step 2: Translation
    const translation = await translateText(transcript);
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
    
    // Maintain context for better translations
    translationContext.push({ original: transcript, translated: translation });
    if (translationContext.length > 10) {
      translationContext.shift(); // Keep last 10 translations
    }
    
  } catch (error) {
    console.error('Error processing audio:', error);
  }
}

// Speech-to-Text using OpenAI Whisper API (with Web Speech API fallback)
async function speechToText(audioBlob) {
  const settings = await getSettings();
  
  // Option 1: OpenAI Whisper (recommended for lectures)
  if (settings.openaiApiKey) {
    try {
      return await whisperTranscribe(audioBlob, settings.openaiApiKey);
    } catch (error) {
      console.error('Whisper API error:', error);
      // Fall through to Web Speech API
    }
  }
  
  // Option 2: Web Speech API (free, but less accurate)
  if (settings.useWebSpeechAPI) {
    return await webSpeechTranscribe(audioBlob);
  }
  
  throw new Error('No speech-to-text service configured');
}

// OpenAI Whisper transcription
async function whisperTranscribe(audioBlob, apiKey) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en'); // Can be auto-detected
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Whisper API error');
  }
  
  const data = await response.json();
  return data.text;
}

// Web Speech API transcription (fallback)
async function webSpeechTranscribe(audioBlob) {
  return new Promise((resolve, reject) => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };
    
    recognition.onerror = (event) => {
      reject(new Error(`Speech recognition error: ${event.error}`));
    };
    
    // Note: Web Speech API requires microphone access, not audio blob
    // This is a simplified fallback - in practice, you'd need to play the audio
    recognition.start();
    
    // Timeout after 5 seconds
    setTimeout(() => {
      recognition.stop();
      reject(new Error('Speech recognition timeout'));
    }, 5000);
  });
}

// Translate text using Google Translate API or DeepL
async function translateText(text) {
  const settings = await getSettings();
  const targetLang = settings.targetLanguage || 'zh-CN';
  
  // Check glossary first for technical terms
  const words = text.split(/\s+/);
  for (const word of words) {
    if (glossary.has(word.toLowerCase())) {
      text = text.replace(new RegExp(word, 'gi'), glossary.get(word.toLowerCase()));
    }
  }
  
  // Option 1: DeepL (better quality)
  if (settings.deeplApiKey) {
    try {
      return await deeplTranslate(text, targetLang, settings.deeplApiKey);
    } catch (error) {
      console.error('DeepL API error:', error);
      // Fall through to Google Translate
    }
  }
  
  // Option 2: Google Translate API
  if (settings.googleApiKey) {
    try {
      return await googleTranslate(text, targetLang, settings.googleApiKey);
    } catch (error) {
      console.error('Google Translate API error:', error);
    }
  }
  
  // Option 3: Free Google Translate (no API key, less reliable)
  if (settings.useFreeTranslation) {
    return await freeGoogleTranslate(text, targetLang);
  }
  
  throw new Error('No translation service configured');
}

// DeepL Translation
async function deeplTranslate(text, targetLang, apiKey) {
  // Map language codes to DeepL format
  const deeplLang = mapLanguageToDeepL(targetLang);
  
  const response = await fetch('https://api.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      text: text,
      target_lang: deeplLang,
      source_lang: 'EN'
    })
  });
  
  if (!response.ok) {
    throw new Error('DeepL API error');
  }
  
  const data = await response.json();
  return data.translations[0].text;
}

// Google Translate API
async function googleTranslate(text, targetLang, apiKey) {
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        source: 'en'
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('Google Translate API error');
  }
  
  const data = await response.json();
  return data.data.translations[0].translatedText;
}

// Free Google Translate (web scraping - less reliable)
async function freeGoogleTranslate(text, targetLang) {
  // This is a simplified version - in production, you'd use a proper API
  // or a service that wraps Google Translate
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data[0][0][0];
  } catch (error) {
    throw new Error('Free translation service unavailable');
  }
}

// Map language codes to DeepL format
function mapLanguageToDeepL(lang) {
  const mapping = {
    'zh-CN': 'ZH',
    'zh-TW': 'ZH',
    'es': 'ES',
    'fr': 'FR',
    'de': 'DE',
    'ja': 'JA',
    'ko': 'KO',
    'pt': 'PT',
    'ru': 'RU',
    'it': 'IT',
    'nl': 'NL',
    'pl': 'PL'
  };
  return mapping[lang] || lang.toUpperCase();
}

// Convert audio buffer to WAV format
function audioBufferToWav(buffer) {
  const sampleRate = (audioContext && audioContext.sampleRate) || 44100;
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
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  
  if (audioContext && typeof audioContext.close === 'function') {
    audioContext.close();
  }
  audioContext = null;
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  // Clean up content script audio capture
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stopAudioCapture'
      });
    }
  });
  
  isRecording = false;
  audioBuffer = [];
  
  console.log('Audio capture stopped');
}

// Get settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'targetLanguage',
      'openaiApiKey',
      'deeplApiKey',
      'googleApiKey',
      'useWebSpeechAPI',
      'useFreeTranslation',
      'bufferDuration'
    ], (result) => {
      resolve({
        targetLanguage: result.targetLanguage || 'zh-CN',
        openaiApiKey: result.openaiApiKey || '',
        deeplApiKey: result.deeplApiKey || '',
        googleApiKey: result.googleApiKey || '',
        useWebSpeechAPI: result.useWebSpeechAPI !== false,
        useFreeTranslation: result.useFreeTranslation || false,
        bufferDuration: result.bufferDuration || 5000
      });
    });
  });
}
