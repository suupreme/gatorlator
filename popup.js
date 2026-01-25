// Popup script for Gatorlator Extension

document.addEventListener('DOMContentLoaded', function() {
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
  
  // Load saved settings
  loadSettings();
  
  // Language selection
  const targetLangSelect = document.getElementById('targetLang');
  targetLangSelect.addEventListener('change', function() {
    chrome.storage.sync.set({ 
      targetLang: this.value,
      targetLanguage: this.value 
    }, function() {
      updateActiveTab();
    });
  });
  
  // Enable/disable toggle
  const enableToggle = document.getElementById('enableToggle');
  enableToggle.addEventListener('change', function() {
    chrome.storage.sync.set({ enabled: this.checked }, function() {
      updateActiveTab();
    });
  });
  
  // Audio mode selector
  const audioModeSelect = document.getElementById('audioMode');
  if (audioModeSelect) {
    audioModeSelect.addEventListener('change', function() {
      chrome.storage.sync.set({ audioMode: this.value });
    });
  }
  
  // Start/Stop button
  const startStopBtn = document.getElementById('startStopBtn');
  startStopBtn.addEventListener('click', async function() {
    const isEnabled = enableToggle.checked;
    
    if (isEnabled) {
      // Start capture
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          const settings = await getStoredSettings();
          const response = await chrome.runtime.sendMessage({ 
            action: 'startCapture',
            mode: settings.audioMode || 'tab'
          });
          
          if (response && response.success) {
            startStopBtn.textContent = 'Stop Translation';
            enableToggle.disabled = true;
            updateStatus('Recording audio...', 'recording');
          } else {
            updateStatus('Failed to start: ' + (response?.error || 'Unknown error'), 'error');
          }
        }
      } catch (error) {
        updateStatus('Error: ' + error.message, 'error');
      }
    } else {
      // Stop capture
      try {
        await chrome.runtime.sendMessage({ action: 'stopCapture' });
        startStopBtn.textContent = 'Start Translation';
        enableToggle.disabled = false;
        updateStatus('Stopped', '');
      } catch (error) {
        updateStatus('Error: ' + error.message, 'error');
      }
    }
  });
  
  // Save settings button
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  saveSettingsBtn.addEventListener('click', function() {
    saveSettings();
    saveSettingsBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveSettingsBtn.textContent = 'Save Settings';
    }, 2000);
  });
  
  // Check status periodically
  setInterval(checkStatus, 2000);
  checkStatus();
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get([
    'targetLang',
    'targetLanguage',
    'enabled',
    'speachesApiKey',
    'speachesApiUrl',
    'model',
    'enableAudioOutput',
    'audioMode'
  ], function(result) {
    // Main settings
    if (result.targetLang) {
      const langSelect = document.getElementById('targetLang');
      if (langSelect) langSelect.value = result.targetLang;
    }
    if (result.targetLanguage) {
      const langSelect = document.getElementById('targetLang');
      if (langSelect) langSelect.value = result.targetLanguage;
    }
    if (result.enabled !== undefined) {
      const toggle = document.getElementById('enableToggle');
      if (toggle) toggle.checked = result.enabled;
    }
    
    // Audio mode
    if (result.audioMode) {
      const modeSelect = document.getElementById('audioMode');
      if (modeSelect) modeSelect.value = result.audioMode;
    }
    
    // Speaches.ai settings
    if (result.speachesApiKey) {
      const input = document.getElementById('speachesApiKey');
      if (input) {
        input.value = result.speachesApiKey;
        input.placeholder = maskApiKey(result.speachesApiKey);
      }
    }
    if (result.speachesApiUrl) {
      const input = document.getElementById('speachesApiUrl');
      if (input) {
        input.value = result.speachesApiUrl;
      }
    }
    if (result.model) {
      const input = document.getElementById('model');
      if (input) {
        input.value = result.model;
      }
    }
    
    // Toggles
    const audioOutputToggle = document.getElementById('enableAudioOutput');
    if (audioOutputToggle) {
      audioOutputToggle.checked = result.enableAudioOutput !== false;
    }
  });
}

// Helper to get stored settings
function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['audioMode'], (result) => {
      resolve(result);
    });
  });
}

// Save settings to storage
function saveSettings() {
  const settings = {
    speachesApiKey: document.getElementById('speachesApiKey')?.value.trim() || '',
    speachesApiUrl: document.getElementById('speachesApiUrl')?.value.trim() || 'https://speaches.ai/v1',
    model: document.getElementById('model')?.value.trim() || 'gpt-4o-mini',
    enableAudioOutput: document.getElementById('enableAudioOutput')?.checked !== false,
    audioMode: document.getElementById('audioMode')?.value || 'tab'
  };
  
  chrome.storage.sync.set(settings, function() {
    console.log('Settings saved');
  });
}

// Update active tab with current settings
function updateActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateLanguage',
        language: document.getElementById('targetLang').value
      });
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleSubtitles',
        enabled: document.getElementById('enableToggle').checked
      });
    }
  });
}

// Check current recording status
async function checkStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    if (response) {
      const startStopBtn = document.getElementById('startStopBtn');
      const enableToggle = document.getElementById('enableToggle');
      
      if (response.isRecording) {
        startStopBtn.textContent = 'Stop Translation';
        enableToggle.disabled = true;
        updateStatus('Recording audio...', 'recording');
      } else {
        startStopBtn.textContent = 'Start Translation';
        enableToggle.disabled = false;
        
        if (response.hasStream) {
          updateStatus('Ready', '');
        } else {
          updateStatus('Click "Start Translation" to begin', '');
        }
      }
    }
  } catch (error) {
    console.error('Error checking status:', error);
  }
}

// Update status display
function updateStatus(message, type) {
  const statusCard = document.getElementById('status-card');
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status';
  if (type === 'recording') {
    statusCard.classList.add('recording');
  } else {
    statusCard.classList.remove('recording');
  }
}

// Mask API key for display
function maskApiKey(key) {
  if (!key || key.length < 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}
