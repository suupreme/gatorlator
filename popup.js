// Popup script for Luma Translation Extension

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
  
  // Start/Stop button
  const startStopBtn = document.getElementById('startStopBtn');
  startStopBtn.addEventListener('click', async function() {
    const isEnabled = enableToggle.checked;
    
    if (isEnabled) {
      // Start capture
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          const response = await chrome.runtime.sendMessage({ 
            action: 'startCapture' 
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
    'enabled',
    'openaiApiKey',
    'deeplApiKey',
    'googleApiKey',
    'useWebSpeechAPI',
    'useFreeTranslation'
  ], function(result) {
    // Main settings
    if (result.targetLang) {
      document.getElementById('targetLang').value = result.targetLang;
    }
    if (result.targetLanguage) {
      document.getElementById('targetLang').value = result.targetLanguage;
    }
    if (result.enabled !== undefined) {
      document.getElementById('enableToggle').checked = result.enabled;
    }
    
    // API keys (masked display)
    if (result.openaiApiKey) {
      const masked = maskApiKey(result.openaiApiKey);
      document.getElementById('openaiApiKey').value = result.openaiApiKey;
      document.getElementById('openaiApiKey').placeholder = masked;
    }
    if (result.deeplApiKey) {
      document.getElementById('deeplApiKey').value = result.deeplApiKey;
      document.getElementById('deeplApiKey').placeholder = maskApiKey(result.deeplApiKey);
    }
    if (result.googleApiKey) {
      document.getElementById('googleApiKey').value = result.googleApiKey;
      document.getElementById('googleApiKey').placeholder = maskApiKey(result.googleApiKey);
    }
    
    // Advanced settings
    document.getElementById('useWebSpeechAPI').checked = result.useWebSpeechAPI !== false;
    document.getElementById('useFreeTranslation').checked = result.useFreeTranslation || false;
  });
}

// Save settings to storage
function saveSettings() {
  const settings = {
    openaiApiKey: document.getElementById('openaiApiKey').value.trim(),
    deeplApiKey: document.getElementById('deeplApiKey').value.trim(),
    googleApiKey: document.getElementById('googleApiKey').value.trim(),
    useWebSpeechAPI: document.getElementById('useWebSpeechAPI').checked,
    useFreeTranslation: document.getElementById('useFreeTranslation').checked
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
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status';
  if (type) {
    statusEl.classList.add(type);
  }
}

// Mask API key for display
function maskApiKey(key) {
  if (!key || key.length < 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}
