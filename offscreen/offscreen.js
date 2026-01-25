const DEEPGRAM_API_KEY = "";
const DEEPL_API_KEY = "";
const ELEVENLABS_API_KEY = "";

// https://elevenlabs.io/app/agents/voice-library?voiceId=Wl3O9lmFSMgGFTTwuS6f
const VOICE_ID = "Wl3O9lmFSMgGFTTwuS6f";

const ELEVENLABS_VOICES = {
  ar: "UgBBYS2sOqTuMpoF3BR0", // Arabic
  yue: "WuLq5z7nEcrhppO0ZQJw", // Cantonese
  zh: "WuLq5z7nEcrhppO0ZQJw", // Mandarin
  fr: "UgBBYS2sOqTuMpoF3BR0", // French
  de: "UgBBYS2sOqTuMpoF3BR0", // German
  hi: "ymDCYd8puC7gYjxIamPt", // Hindi
  ko: "UgBBYS2sOqTuMpoF3BR0", // Korean
  pt: "UgBBYS2sOqTuMpoF3BR0", // Portuguese
  ru: "ymDCYd8puC7gYjxIamPt", // Russian
  es: "UgBBYS2sOqTuMpoF3BR0", // Spanish
};

let targetLanguage;

let ttsQueue = [];
let isProcessingQueue = false;
let currentAudio = null; // Track the active audio object

const API_URL = "https://api-free.deepl.com/v2/translate";

let mediaRecorder;
let socket = null;
let transcriptBuffer = "";
let stream = null; // Declare stream globally

// Listen for commands from the Background Script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.target !== "offscreen") {
    // If not for offscreen, don't send a response. This avoids errors if another listener processes it.
    return;
  }

  switch (message.type) {
    case "START_RECORDING":
      await startStreaming(message.streamId);
      targetLanguage = message.language; // Re-added this line
      sendResponse({ status: "success", message: "Recording started" }); // Respond after starting
      break;
    case "STOP_RECORDING":
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Send a close frame to Deepgram so it finishes processing immediately
        socket.send(JSON.stringify({ type: "CloseStream" }));
        socket.close();
        socket = null; // Reset for next time
      }
      stopAllTTS();
      stopStream(); // Call to stop the underlying MediaStream
      sendResponse({ status: "success", message: "Recording stopped" }); // Respond after stopping
      break;
    case "PLAY_AUDIO":
      // Background script sends the audio buffer here to be played
      playAudio(message.audioBuffer);
      sendResponse({ status: "success", message: "Audio played" }); // Respond after playing
      break;
    case "SET_LANGUAGE":
      targetLanguage = message.language;
      break;
  }
  return true; // Indicate that sendResponse will be called asynchronously
});

async function startStreaming(streamId) {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // Prevent muting: route the captured stream to the AudioContext destination
  /*   const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(audioContext.destination);
 */
  startDeepgram(stream);
}

function startDeepgram(stream) {
  // Use 'token' subprotocol to pass the key securely in a browser environment
  socket = new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&endpointing=5&interim_results=true&utterance_end_ms=3000",
    ["token", DEEPGRAM_API_KEY],
  );

  mediaRecorder = new MediaRecorder(stream, {
    // Assign to the global variable
    mimeType: "audio/webm;codecs=opus",
  });

  socket.onopen = () => {
    // Send data every 250ms for low latency
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    };
    mediaRecorder.start(250);
  };

  socket.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    const transcript = data.channel?.alternatives[0]?.transcript;

    if (transcript) {
      if (data.is_final) {
        // 1. Add this chunk to our sentence buffer
        transcriptBuffer += " " + transcript;

        // 2. ONLY call Gemini if the speaker has actually finished their thought
        if (data.speech_final) {
          console.log("Full Sentence Finished:", transcriptBuffer.trim());
          // Use the buffer, then clear it for the next sentence
          const textToTranslate = transcriptBuffer.trim();
          transcriptBuffer = "";

          console.log(targetLanguage);

          const result = await translateText(textToTranslate, targetLanguage);
          const translatedText = result.translations[0].text;
          console.log("Translation:", translatedText);

          // 1. Add to queue
          ttsQueue.push(translatedText);
          // 2. Try to process (it will skip if already playing)
          processQueue();
        }
      } else {
        // This is a "Partial" (interim) result - translate and send to content script
        console.log("Live Preview:", transcript);
        // Translate interim transcript
        const interimResult = await translateText(transcript, targetLanguage);
        const translatedInterimText = interimResult.translations[0].text;

        // Send to background.js, which will then send to content.js
        chrome.runtime.sendMessage({
          target: "background", // Explicitly target background script
          type: "INTERIM_SUBTITLE",
          text: translatedInterimText,
        });
      }
    }
  };

  socket.onerror = (error) => {
    console.error("Deepgram WebSocket Error:", error);
    // Optionally, send an error message back to the background script
    // chrome.runtime.sendMessage({ action: "deepgramError", message: error.message });
  };

  socket.onclose = (event) => {
    console.log("Deepgram WebSocket Closed:", event);
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  };
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    console.log("MediaStream tracks stopped.");
  }
}

async function translateText(text, targetLang) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(errorBody.message || "Translation failed");
  }

  return await response.json();
}

async function playElevenLabsTTS(text) {
  return new Promise(async (resolve, reject) => {
    // Determine the voice ID to use
    const voiceToUse =
      ELEVENLABS_VOICES[targetLanguage] || "Wl3O9lmFSMgGFTTwuS6f"; // Fallback to original VOICE_ID

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceToUse}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_flash_v2_5",
            voice_settings: { stability: 0.5, similarity_boost: 0.8 },
          }),
        },
      );

      if (!response.ok) throw new Error("ElevenLabs API error");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      currentAudio = new Audio(audioUrl);

      currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null; // Clear the reference
        resolve();
      };

      currentAudio.onerror = (e) => {
        currentAudio = null;
        reject(e);
      };

      currentAudio.onerror = (e) => reject(e);

      await currentAudio.play();
    } catch (error) {
      console.error("ElevenLabs TTS Error:", error);
      currentAudio = null;
      resolve(); // Resolve anyway so the queue doesn't get stuck forever
    }
  });
}

async function processQueue() {
  if (isProcessingQueue || ttsQueue.length === 0) return;
  isProcessingQueue = true;

  while (ttsQueue.length > 0) {
    const textToSpeak = ttsQueue.shift();
    try {
      await playElevenLabsTTS(textToSpeak);
    } catch (error) {
      // This catches the error when you stop the audio mid-stream
      console.warn("Audio playback interrupted or failed.");
    }
  }
  isProcessingQueue = false;
}

function stopAllTTS() {
  // 1. Clear the queue so no further lines start
  ttsQueue = [];

  // 2. Stop the currently playing audio immediately
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = ""; // Force release of the audio resource
    currentAudio = null;
  }

  isProcessingQueue = false;
  console.log("TTS Queue cleared and audio stopped.");
}
