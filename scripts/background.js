//--------------------------------
//MESSAGE LISTENER - the main entry point
//--------------------------------
//This listens for message from popup.js or content.js

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  // FLOW 1 : Capture Tab Audio (Current Website -> DeepGram)
  if (request.action === "startCapture") {
    await startCapture(request.language); // Pass language to startCapture
    console.log("starting capture");
    sendResponse({ status: "success", message: "Audio capture started." });
  } else if (request.action === "stopCapture") {
    await stopCapture();
    sendResponse({ status: "success", message: "Audio capture stopped." });
  }
  // FLOW 2: Translate Transcribed Text Received from DeepGram
  else if (request.action === "transcribeAudio") {
    startDeepgram(request.data);
  }
  // FLOW 3: Route Interim Subtitles from Offscreen to Content Script
  else if (request.type === "INTERIM_SUBTITLE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "UPDATE_SUBTITLE", // Message type for content script
          text: request.text,
        });
      }
    });
  }
});
//---------------------------------------------
//TAB AUDIO CAPTURE - (using Offscreen Document)
//---------------------------------------------
async function startCapture(language) { // Accept language argument
  try {
    // If an offscreen document already exists, it means a capture might be active.
    // Stop any existing capture before starting a new one to prevent "active stream" error.
    if (await chrome.offscreen.hasDocument()) {
      console.log(
        "Existing offscreen document found. Stopping previous capture...",
      );
      await stopCapture();
      // Give a small delay to ensure resources are fully released
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Create the Offscreen document if it doesn't already exist
    if (!(await chrome.offscreen.hasDocument())) {
      await chrome.offscreen.createDocument({
        url: "offscreen/offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Recording tab audio for translation",
      });
    }

    // Get the current active tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Request access to the tab's audio using Stream ID
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: activeTab.id,
    });

    //Send the stream ID and language to the Offscreen document
    await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "START_RECORDING",
      streamId: streamId,
      language: language, // Use the passed language
    });
  } catch (error) {
    console.error("Error starting capture:", error);
    chrome.runtime.sendMessage({
      action: "captureStatus",
      status: "error",
      message: error.message,
    });
  }
}

async function stopCapture() {
  try {
    // Only send message if offscreen document exists
    if (await chrome.offscreen.hasDocument()) {
      const response = await chrome.runtime.sendMessage({
        // Await the response
        target: "offscreen",
        type: "STOP_RECORDING",
      });
      console.log("Offscreen document responded to STOP_RECORDING:", response);
      // Remove the offscreen document only after it has stopped recording
      await chrome.offscreen.closeDocument();
    } else {
      console.log("No offscreen document to stop.");
    }
  } catch (error) {
    console.error("Error stopping capture:", error);
  }
}
