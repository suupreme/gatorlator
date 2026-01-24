(function() {
  'use strict';
  
  let isEnabled = true;
  let targetLanguage = 'zh-CN';
  let subtitleContainer = null;
  let currentSubtitle = null;
  let video = null;
  let isCapturing = false;
  let subtitleQueue = [];
  let lastSubtitleTime = 0;
  
  // Subtitle history for "repeat last sentence" feature
  let subtitleHistory = [];
  
  // Initialize
  function init() {
    chrome.storage.sync.get(['targetLang', 'enabled'], function(result) {
      targetLanguage = result.targetLang || 'zh-CN';
      isEnabled = result.enabled !== undefined ? result.enabled : true;
      
      if (isEnabled) {
        createSubtitleContainer();
        findAndAttachToVideo();
        setupMessageListener();
      }
    });
  }
  
  // Listen for messages from background script
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'showSubtitle') {
        displaySubtitle(request.translated, request.original);
        sendResponse({ success: true });
      } else if (request.action === 'captureStarted') {
        isCapturing = true;
        updateStatus('Recording audio...');
      } else if (request.action === 'captureStopped') {
        isCapturing = false;
        updateStatus('Stopped');
      } else if (request.action === 'startAudioCapture') {
        // Start audio capture from content script
        captureTabAudio(request.streamId);
        sendResponse({ success: true });
      } else if (request.action === 'stopAudioCapture') {
        // Stop audio capture
        if (window.__lumaAudioCapture) {
          if (window.__lumaAudioCapture.processor) {
            window.__lumaAudioCapture.processor.disconnect();
          }
          if (window.__lumaAudioCapture.stream) {
            window.__lumaAudioCapture.stream.getTracks().forEach(track => track.stop());
          }
          if (window.__lumaAudioCapture.audioContext) {
            window.__lumaAudioCapture.audioContext.close();
          }
          window.__lumaAudioCapture = null;
        }
        sendResponse({ success: true });
      }
      return true;
    });
  }
  
  // Capture tab audio (runs in page context)
  function captureTabAudio(streamId) {
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
  
  // Create subtitle container
  function createSubtitleContainer() {
    if (subtitleContainer) return;
    
    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'luma-subtitle-container';
    subtitleContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      pointer-events: none;
      max-width: 80%;
      text-align: center;
    `;
    
    currentSubtitle = document.createElement('div');
    currentSubtitle.id = 'luma-subtitle';
    currentSubtitle.style.cssText = `
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 18px;
      font-weight: 500;
      line-height: 1.5;
      letter-spacing: 0.01em;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 800px;
    `;
    
    subtitleContainer.appendChild(currentSubtitle);
    document.body.appendChild(subtitleContainer);
  }
  
  // Find video element
  function findAndAttachToVideo() {
    video = document.querySelector('video');
    
    if (video) {
      attachKeyboardShortcuts();
      // Auto-start capture if enabled
      if (isEnabled) {
        startCapture();
      }
    } else {
      // Retry if video not found (for dynamic pages)
      setTimeout(findAndAttachToVideo, 1000);
    }
  }
  
  // Start audio capture
  async function startCapture() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'startCapture' });
      if (response && response.success) {
        isCapturing = true;
        updateStatus('Recording...');
      } else {
        updateStatus('Failed to start capture');
      }
    } catch (error) {
      console.error('Error starting capture:', error);
      updateStatus('Error: ' + error.message);
    }
  }
  
  // Stop audio capture
  async function stopCapture() {
    try {
      await chrome.runtime.sendMessage({ action: 'stopCapture' });
      isCapturing = false;
      updateStatus('Stopped');
    } catch (error) {
      console.error('Error stopping capture:', error);
    }
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
    lastSubtitleTime = Date.now();
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (Date.now() - lastSubtitleTime >= 5000) {
        currentSubtitle.style.opacity = '0';
      }
    }, 5000);
  }
  
  // Update status indicator
  function updateStatus(message) {
    // Could add a status indicator in the UI
    console.log('Status:', message);
  }
  
  // Keyboard shortcuts
  function attachKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      if (!video) return;
      
      // Ignore if typing in input fields
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      // R - Replay last 10 seconds
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        showFeedback('⏪ -10s');
      }
      
      // T - Toggle subtitles
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        isEnabled = !isEnabled;
        
        if (subtitleContainer) {
          subtitleContainer.style.display = isEnabled ? 'block' : 'none';
        }
        
        if (isEnabled && !isCapturing) {
          startCapture();
        } else if (!isEnabled && isCapturing) {
          stopCapture();
        }
        
        chrome.storage.sync.set({ enabled: isEnabled });
        showFeedback(isEnabled ? 'Subtitles ON' : 'Subtitles OFF');
      }
      
      // P - Pause and show last subtitle (repeat last sentence)
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (video && !video.paused) {
          video.pause();
          if (subtitleHistory.length > 0) {
            const last = subtitleHistory[subtitleHistory.length - 1];
            displaySubtitle(last.translated, last.original);
            showFeedback('Last sentence repeated');
          }
        } else if (video && video.paused) {
          video.play();
        }
      }
      
      // G - Show glossary/context (future feature)
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        showGlossary();
      }
    });
  }
  
  // Show visual feedback
  function showFeedback(message) {
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 16px 32px;
      border-radius: 16px;
      font-size: 24px;
      font-weight: 600;
      z-index: 999999;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transition = 'opacity 0.3s';
      setTimeout(() => feedback.remove(), 300);
    }, 800);
  }
  
  // Show glossary (placeholder for future feature)
  function showGlossary() {
    showFeedback('Glossary feature coming soon');
  }
  
  // Listen for messages from popup (already handled in setupMessageListener, but keep for compatibility)
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateLanguage') {
      targetLanguage = request.language;
      chrome.storage.sync.set({ targetLang: targetLanguage });
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
      chrome.storage.sync.set({ enabled: isEnabled });
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
