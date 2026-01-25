// scripts/content.js
// This script runs in the context of every web page.

// Function to create or update the subtitle display
function updateSubtitle(text) {
  let subtitleContainer = document.getElementById("gatorlator-subtitle-container");

  if (!subtitleContainer) {
    subtitleContainer = document.createElement("div");
    subtitleContainer.id = "gatorlator-subtitle-container";
    // Basic styling for visibility - this can be enhanced with CSS
    subtitleContainer.style.position = "fixed";
    subtitleContainer.style.bottom = "20px";
    subtitleContainer.style.left = "50%";
    subtitleContainer.style.transform = "translateX(-50%)";
    subtitleContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    subtitleContainer.style.color = "white";
    subtitleContainer.style.padding = "10px 15px";
    subtitleContainer.style.borderRadius = "8px";
    subtitleContainer.style.fontSize = "24px";
    subtitleContainer.style.fontFamily = "sans-serif";
    subtitleContainer.style.zIndex = "2147483647"; // Max z-index
    subtitleContainer.style.maxWidth = "80%";
    subtitleContainer.style.textAlign = "center";
    subtitleContainer.style.pointerEvents = "none"; // Allow clicks to pass through
    document.body.appendChild(subtitleContainer);
  }
  subtitleContainer.textContent = text;

  // Clear subtitle after a short delay if it's an interim update
  // This will be handled by subsequent messages or an empty string for final thoughts
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_SUBTITLE") {
    updateSubtitle(message.text);
    sendResponse({ status: "success", message: "Subtitle updated" });
  } else if (message.type === "CLEAR_SUBTITLE") {
    const subtitleContainer = document.getElementById("gatorlator-subtitle-container");
    if (subtitleContainer) {
      subtitleContainer.textContent = "";
    }
    sendResponse({ status: "success", message: "Subtitle cleared" });
  } else if (message.type === "TOGGLE_SUBTITLES") {
    const subtitleContainer = document.getElementById("gatorlator-subtitle-container");
    if (subtitleContainer) {
      subtitleContainer.style.display = message.enabled ? "block" : "none";
    }
    sendResponse({ status: "success", message: "Subtitles toggled" });
  }
  // If you need to handle asynchronous responses, return true
  return true;
});

console.log("Gatorlator content script loaded.");