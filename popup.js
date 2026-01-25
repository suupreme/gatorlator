// Popup script for Gatorlator Extension

// let isTranslating = false;

document.addEventListener("DOMContentLoaded", function () {
  const toggleButton = document.getElementById("toggleTranslation");
  // Load saved settings
  // loadSettings();

  toggleButton.addEventListener("click", () => {
    isTranslationEnabled = !isTranslationEnabled;
    chrome.storage.sync.set({ isTranslationEnabled: isTranslationEnabled });
    updateUI();

    // Clean and idiomatic
    const actionType = isTranslationEnabled ? "startCapture" : "stopCapture";

    // Send message to background.js to enable/disable live translation
    chrome.runtime.sendMessage({ action: actionType }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending message:",
          chrome.runtime.lastError.message,
        );
      } else {
        console.log("Response from background:", response.message);
      }
    });

    console.log(
      `Live translation ${isTranslationEnabled ? "enabled" : "disabled"} for ${targetLanguage}`,
    );
  });

  // Language selection
  const targetLangSelect = document.getElementById("targetLang");
  targetLangSelect.addEventListener("change", function () {
    if (this.value) {
      chrome.storage.sync.set(
        {
          targetLang: this.value,
          targetLanguage: this.value,
        },
        function () {
          updateActiveTab();
        },
      );
    }
  });

  // [cc] button - replaces Enable Subtitles toggle
  const ccBtn = document.getElementById("ccBtn");
  let subtitlesEnabled = true; // Default to enabled

  // Load saved subtitle state
  chrome.storage.sync.get(["enabled"], function (result) {
    if (result.enabled !== undefined) {
      subtitlesEnabled = result.enabled;
    }
    updateCcButton();
  });

  ccBtn.addEventListener("click", function () {
    subtitlesEnabled = !subtitlesEnabled;
    chrome.storage.sync.set({ enabled: subtitlesEnabled }, function () {
      updateCcButton();
      updateActiveTab();
    });
  });

  function updateCcButton() {
    if (subtitlesEnabled) {
      ccBtn.classList.add("active");
    } else {
      ccBtn.classList.remove("active");
    }
  }

  /*   // Settings button
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn"); */
  /* 
  settingsBtn.addEventListener("click", function () {
    settingsPanel.classList.add("active");
  });

  closeSettingsBtn.addEventListener("click", function () {
    settingsPanel.classList.remove("active");
  });

  // Close settings panel when clicking outside
  settingsPanel.addEventListener("click", function (e) {
    if (e.target === settingsPanel) {
      settingsPanel.classList.remove("active");
    }
  }); */

  // Help button
  const helpBtn = document.getElementById("helpBtn");
  const helpPanel = document.getElementById("helpPanel");
  const closeHelpBtn = document.getElementById("closeHelpBtn");

  helpBtn.addEventListener("click", function () {
    helpPanel.classList.add("active");
  });

  closeHelpBtn.addEventListener("click", function () {
    helpPanel.classList.remove("active");
  });

  // Close help panel when clicking outside
  helpPanel.addEventListener("click", function (e) {
    if (e.target === helpPanel) {
      helpPanel.classList.remove("active");
    }
  });

  /*   // Save settings button
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  saveSettingsBtn.addEventListener("click", function () {
    saveSettings();
    saveSettingsBtn.textContent = "Saved!";
    setTimeout(() => {
      saveSettingsBtn.textContent = "Save Settings";
    }, 2000);
  }); */

  // Check status periodically
  setInterval(checkStatus, 2000);
  checkStatus();
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(
    [
      "targetLang",
      "targetLanguage",
      "enabled",
      "speachesApiKey",
      "speachesApiUrl",
      "model",
      "enableAudioOutput",
      "audioMode",
    ],
    function (result) {
      // Main settings
      const langSelect = document.getElementById("targetLang");
      if (langSelect) {
        if (result.targetLang && result.targetLang !== "") {
          langSelect.value = result.targetLang;
        } else if (result.targetLanguage && result.targetLanguage !== "") {
          langSelect.value = result.targetLanguage;
        } else {
          // Reset to placeholder if no valid language is saved
          langSelect.value = "";
        }
      }

      // Speaches.ai settings
      if (result.speachesApiKey) {
        const input = document.getElementById("speachesApiKey");
        if (input) {
          input.value = result.speachesApiKey;
          input.placeholder = maskApiKey(result.speachesApiKey);
        }
      }
      if (result.speachesApiUrl) {
        const input = document.getElementById("speachesApiUrl");
        if (input) {
          input.value = result.speachesApiUrl;
        }
      }
      if (result.model) {
        const input = document.getElementById("model");
        if (input) {
          input.value = result.model;
        }
      }

      // Toggles
      const audioOutputToggle = document.getElementById("enableAudioOutput");
      if (audioOutputToggle) {
        audioOutputToggle.checked = result.enableAudioOutput !== false;
      }
    },
  );
}

// Helper to get stored settings
function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["audioMode"], (result) => {
      resolve(result);
    });
  });
}

// Save settings to storage
function saveSettings() {
  const settings = {
    speachesApiKey:
      document.getElementById("speachesApiKey")?.value.trim() || "",
    speachesApiUrl:
      document.getElementById("speachesApiUrl")?.value.trim() ||
      "https://speaches.ai/v1",
    model: document.getElementById("model")?.value.trim() || "gpt-4o-mini",
    enableAudioOutput:
      document.getElementById("enableAudioOutput")?.checked !== false,
    audioMode: document.getElementById("audioMode")?.value || "tab",
  };

  chrome.storage.sync.set(settings, function () {
    console.log("Settings saved");
  });
}

// Update active tab with current settings
function updateActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "updateLanguage",
        language: document.getElementById("targetLang").value,
      });

      chrome.storage.sync.get(["enabled"], function (result) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleSubtitles",
          enabled: result.enabled !== false,
        });
      });
    }
  });
}

// Check current recording status
async function checkStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getStatus" });
    if (response) {
      const startStopBtn = document.getElementById("startStopBtn");

      if (response.isRecording) {
        isTranslating = true;
        updateButtonStatus("stop translating", "recording");
      } else {
        isTranslating = false;
        updateButtonStatus("start translation", "");
      }
    }
  } catch (error) {
    console.error("Error checking status:", error);
  }
}

// Update button status (integrated status messages)
function updateButtonStatus(message, type) {
  const startStopBtn = document.getElementById("startStopBtn");
  startStopBtn.textContent = message;
  startStopBtn.className = "button";
  if (type === "recording") {
    startStopBtn.classList.add("recording");
  } else if (type === "error") {
    startStopBtn.classList.add("error");
  }
}

// Mask API key for display
function maskApiKey(key) {
  if (!key || key.length < 8) return "••••••••";
  return key.substring(0, 4) + "••••••••" + key.substring(key.length - 4);
}
