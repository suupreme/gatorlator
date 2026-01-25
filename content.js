(function() {
  'use strict';
  
  let isEnabled = true;
  let targetLanguage = 'zh-CN';
  let subtitleContainer = null;
  let currentSubtitle = null;
  let floatingUI = null;
  let audioMode = 'tab'; // 'tab' or 'mic'
  let isCapturing = false;
  let audioContext = null;
  let audioProcessor = null;
  let mediaStream = null;
  let audioPlaybackContext = null;
  let lastAudioChunkTime = 0;
  let subtitleHistory = [];
  
  // Initialize
  function init() {
    chrome.storage.sync.get(['targetLang', 'enabled', 'audioMode'], function(result) {
      targetLanguage = result.targetLang || 'zh-CN';
      isEnabled = result.enabled !== undefined ? result.enabled : true;
      audioMode = result.audioMode || 'tab';
      
      if (isEnabled) {
        createFloatingUI();
        createSubtitleContainer();
        setupMessageListener();
      }
    });
  }
  
  // Create modern floating UI overlay
  function createFloatingUI() {
    if (floatingUI) return;
    
    floatingUI = document.createElement('div');
    floatingUI.id = 'gatorlator-floating-ui';
    floatingUI.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    const pill = document.createElement('div');
    pill.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 32px;
      padding: 8px 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    // Audio mode toggle
    const modeToggle = document.createElement('button');
    modeToggle.id = 'gatorlator-mode-toggle';
    modeToggle.innerHTML = audioMode === 'tab' ? '🎧' : '🎤';
    modeToggle.title = audioMode === 'tab' ? 'Tab Audio' : 'Microphone';
    modeToggle.style.cssText = `
      background: transparent;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
      transition: background 0.2s;
    `;
    modeToggle.addEventListener('click', toggleAudioMode);
    modeToggle.addEventListener('mouseenter', () => {
      modeToggle.style.background = 'rgba(0, 0, 0, 0.05)';
    });
    modeToggle.addEventListener('mouseleave', () => {
      modeToggle.style.background = 'transparent';
    });
    
    // Status indicator
    const status = document.createElement('div');
    status.id = 'gatorlator-status';
    status.textContent = 'Ready';
    status.style.cssText = `
      font-size: 13px;
      color: #666;
      font-weight: 500;
    `;
    
    // Start/Stop button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'gatorlator-toggle-btn';
    toggleBtn.textContent = 'Start';
    toggleBtn.style.cssText = `
      background: #6366f1;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    toggleBtn.addEventListener('click', toggleCapture);
    toggleBtn.addEventListener('mouseenter', () => {
      toggleBtn.style.background = '#4f46e5';
    });
    toggleBtn.addEventListener('mouseleave', () => {
      toggleBtn.style.background = '#6366f1';
    });
    
    // Language selector (compact)
    const langSelect = document.createElement('select');
    langSelect.id = 'gatorlator-lang-select';
    langSelect.style.cssText = `
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      outline: none;
    `;
    
    const languages = [
      { code: 'zh-CN', name: '中文' },
      { code: 'es', name: 'Español' },
      { code: 'hi', name: 'हिन्दी' },
      { code: 'ar', name: 'العربية' },
      { code: 'pt', name: 'Português' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'ru', name: 'Русский' }
    ];
    
    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      if (lang.code === targetLanguage) option.selected = true;
      langSelect.appendChild(option);
    });
    
    langSelect.addEventListener('change', (e) => {
      targetLanguage = e.target.value;
      chrome.storage.sync.set({ targetLang: targetLanguage, targetLanguage: targetLanguage });
      chrome.runtime.sendMessage({ action: 'updateLanguage', language: targetLanguage });
    });
    
    pill.appendChild(modeToggle);
    pill.appendChild(status);
    pill.appendChild(langSelect);
    pill.appendChild(toggleBtn);
    floatingUI.appendChild(pill);
    document.body.appendChild(floatingUI);
  }
  
  // Toggle audio mode (tab/mic)
  async function toggleAudioMode() {
    audioMode = audioMode === 'tab' ? 'mic' : 'tab';
    chrome.storage.sync.set({ audioMode: audioMode });
    
    const toggle = document.getElementById('gatorlator-mode-toggle');
    toggle.innerHTML = audioMode === 'tab' ? '🎧' : '🎤';
    toggle.title = audioMode === 'tab' ? 'Tab Audio' : 'Microphone';
    
    // Restart capture if currently recording
    if (isCapturing) {
      await stopCapture();
      setTimeout(() => startCapture(), 500);
    }
  }
  
  // Toggle capture
  async function toggleCapture() {
    if (isCapturing) {
      await stopCapture();
    } else {
      await startCapture();
    }
  }
  
  // Listen for messages from background script
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'showSubtitle') {
        displaySubtitle(request.translated, request.original);
        sendResponse({ success: true });
      } else if (request.action === 'captureStarted') {
        isCapturing = true;
        updateStatus('Recording...', 'recording');
        const btn = document.getElementById('gatorlator-toggle-btn');
        if (btn) btn.textContent = 'Stop';
      } else if (request.action === 'captureStopped') {
        isCapturing = false;
        updateStatus('Stopped', '');
        const btn = document.getElementById('gatorlator-toggle-btn');
        if (btn) btn.textContent = 'Start';
      } else if (request.action === 'startAudioCapture') {
        startAudioCapture(request.streamId, request.mode);
        sendResponse({ success: true });
      } else if (request.action === 'stopAudioCapture') {
        stopAudioCapture();
        sendResponse({ success: true });
      } else if (request.action === 'playAudio') {
        playAudio(request.audioUrl, request.text);
        sendResponse({ success: true });
      } else if (request.action === 'updateLanguage') {
        targetLanguage = request.language;
        const select = document.getElementById('gatorlator-lang-select');
        if (select) select.value = targetLanguage;
      }
      return true;
    });
  }
  
  // Start audio capture with streaming chunks
  function startAudioCapture(streamId, mode) {
    audioMode = mode || audioMode;
    
    const constraints = audioMode === 'tab' ? {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    } : {
      audio: true
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        mediaStream = stream;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        
        // Use AudioWorklet or ScriptProcessor for real-time processing
        // For now, using ScriptProcessor (deprecated but widely supported)
        // In production, consider AudioWorklet for better performance
        const bufferSize = 4096;
        audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        let audioChunks = [];
        let lastSend = Date.now();
        const chunkInterval = 300; // Send chunks every 300ms for low latency
        
        audioProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          audioChunks.push(new Float32Array(inputData));
          
          const now = Date.now();
          if (now - lastSend >= chunkInterval && audioChunks.length > 0) {
            // Combine chunks
            const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }
            
            // Send to background script for processing
            chrome.runtime.sendMessage({
              action: 'audioChunk',
              data: Array.from(combined),
              sampleRate: audioContext.sampleRate,
              isFinal: false // Streaming mode
            });
            
            audioChunks = [];
            lastSend = now;
            lastAudioChunkTime = now;
          }
        };
        
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
        
        // Send final chunk periodically (every 2 seconds) for better accuracy
        const finalChunkInterval = setInterval(() => {
          if (audioChunks.length > 0 && isCapturing) {
            const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }
            
            chrome.runtime.sendMessage({
              action: 'audioChunk',
              data: Array.from(combined),
              sampleRate: audioContext.sampleRate,
              isFinal: true
            });
            
            audioChunks = [];
          }
        }, 2000);
        
      // Store reference for cleanup
      window.__gatorlatorAudioCapture = {
          stream, 
          audioContext, 
          processor: audioProcessor,
          interval: finalChunkInterval
        };
        
      }).catch(err => {
        console.error('Error in audio capture:', err);
        chrome.runtime.sendMessage({
          action: 'captureError',
          error: err.message
        });
        updateStatus('Capture Error', 'error');
      });
  }
  
  // Stop audio capture
  function stopAudioCapture() {
    if (window.__gatorlatorAudioCapture) {
      if (window.__gatorlatorAudioCapture.interval) {
        clearInterval(window.__gatorlatorAudioCapture.interval);
      }
      if (window.__gatorlatorAudioCapture.processor) {
        window.__gatorlatorAudioCapture.processor.disconnect();
      }
      if (window.__gatorlatorAudioCapture.stream) {
        window.__gatorlatorAudioCapture.stream.getTracks().forEach(track => track.stop());
      }
      if (window.__gatorlatorAudioCapture.audioContext) {
        window.__gatorlatorAudioCapture.audioContext.close();
      }
      window.__gatorlatorAudioCapture = null;
    }
    
    if (audioProcessor) {
      audioProcessor.disconnect();
      audioProcessor = null;
    }
    
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
  }
  
  // Start capture
  async function startCapture() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'startCapture',
        mode: audioMode
      });
      if (response && response.success) {
        isCapturing = true;
        updateStatus('Starting...', '');
      } else {
        updateStatus('Failed to start', 'error');
      }
    } catch (error) {
      console.error('Error starting capture:', error);
      updateStatus('Error: ' + error.message, 'error');
    }
  }
  
  // Stop capture
  async function stopCapture() {
    try {
      await chrome.runtime.sendMessage({ action: 'stopCapture' });
      stopAudioCapture();
      isCapturing = false;
      updateStatus('Stopped', '');
    } catch (error) {
      console.error('Error stopping capture:', error);
    }
  }
  
  // Create subtitle container
  function createSubtitleContainer() {
    if (subtitleContainer) return;
    
    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'gatorlator-subtitle-container';
    subtitleContainer.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      pointer-events: none;
      max-width: 80%;
      text-align: center;
    `;
    
    currentSubtitle = document.createElement('div');
    currentSubtitle.id = 'gatorlator-subtitle';
    currentSubtitle.style.cssText = `
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 16px 28px;
      border-radius: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 18px;
      font-weight: 500;
      line-height: 1.6;
      letter-spacing: 0.01em;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 900px;
      word-wrap: break-word;
    `;
    
    subtitleContainer.appendChild(currentSubtitle);
    document.body.appendChild(subtitleContainer);
  }
  
  // Display subtitle with fade effect
  function displaySubtitle(translatedText, originalText) {
    if (!currentSubtitle || !isEnabled) return;
    
    // Add to history
    subtitleHistory.push({
      original: originalText,
      translated: translatedText,
      timestamp: Date.now()
    });
    
    // Keep last 20 subtitles
    if (subtitleHistory.length > 20) {
      subtitleHistory.shift();
    }
    
    // Update subtitle display
    currentSubtitle.textContent = translatedText;
    currentSubtitle.style.opacity = '1';
    
    // Auto-hide after 5 seconds of no new subtitles
    clearTimeout(window.__gatorlatorSubtitleTimeout);
    window.__gatorlatorSubtitleTimeout = setTimeout(() => {
      currentSubtitle.style.opacity = '0';
    }, 5000);
  }
  
  // Play audio from ElevenLabs
  function playAudio(audioUrl, text) {
    if (!audioUrl) return;
    
    // Initialize audio context for playback if needed
    if (!audioPlaybackContext) {
      audioPlaybackContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Create audio element for simple playback
    const audio = new Audio(audioUrl);
    audio.volume = 0.8; // Slightly lower than original audio
    
    audio.play().catch(err => {
      console.error('Error playing audio:', err);
    });
    
    // Clean up blob URL after playback
    audio.addEventListener('ended', () => {
      if (audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    });
  }
  
  // Update status indicator
  function updateStatus(message, type) {
    const status = document.getElementById('gatorlator-status');
    if (status) {
      status.textContent = message;
      status.style.color = type === 'recording' ? '#10b981' : 
                          type === 'error' ? '#ef4444' : '#666';
    }
  }
  
  // Keyboard shortcuts
  function attachKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Ignore if typing in input fields
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.isContentEditable) {
        return;
      }
      
      // T - Toggle subtitles/capture
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleCapture();
      }
      
      // M - Toggle audio mode
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleAudioMode();
      }
      
      // P - Show last subtitle
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (subtitleHistory.length > 0) {
          const last = subtitleHistory[subtitleHistory.length - 1];
          displaySubtitle(last.translated, last.original);
        }
      }
    });
  }
  
  // Initialize keyboard shortcuts
  attachKeyboardShortcuts();
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateLanguage') {
      targetLanguage = request.language;
      const select = document.getElementById('gatorlator-lang-select');
      if (select) select.value = targetLanguage;
    } else if (request.action === 'toggleSubtitles') {
      isEnabled = request.enabled;
      if (subtitleContainer) {
        subtitleContainer.style.display = isEnabled ? 'block' : 'none';
      }
      if (isEnabled && !isCapturing) {
        startCapture();
      } else if (!isEnabled && isCapturing) {
        stopCapture();
      }
    }
    sendResponse({ success: true });
    return true;
  });
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
