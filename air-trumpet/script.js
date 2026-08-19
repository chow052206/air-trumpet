import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const video = document.querySelector("#webcam");
const canvas = document.querySelector("#canvas");
const canvasContext = canvas.getContext("2d");

const startButton = document.querySelector("#startButton");
const statusText = document.querySelector("#status");
const currentNoteText = document.querySelector("#currentNote");
const pinchDistanceText = document.querySelector("#pinchDistance");

let handLandmarker = null;
let drawingUtils = null;

let cameraRunning = false;
let lastVideoTime = -1;

// Audio context for generating trumpet sounds
let audioContext = null;
let activeOscillator = null;
let activeGainNode = null;

// Musical notes configuration (chromatic scale starting from C4)
const NOTES = [
  { name: "C4", frequency: 261.63 },
  { name: "C#4", frequency: 277.18 },
  { name: "D4", frequency: 293.66 },
  { name: "D#4", frequency: 311.13 },
  { name: "E4", frequency: 329.63 },
  { name: "F4", frequency: 349.23 },
  { name: "F#4", frequency: 369.99 },
  { name: "G4", frequency: 392.00 },
  { name: "G#4", frequency: 415.30 },
  { name: "A4", frequency: 440.00 },
  { name: "A#4", frequency: 466.16 },
  { name: "B4", frequency: 493.88 },
  { name: "C5", frequency: 523.25 },
  { name: "C#5", frequency: 554.37 },
  { name: "D5", frequency: 587.33 },
  { name: "D#5", frequency: 622.25 },
  { name: "E5", frequency: 659.25 },
  { name: "F5", frequency: 698.46 },
  { name: "F#5", frequency: 739.99 },
  { name: "G5", frequency: 783.99 },
  { name: "G#5", frequency: 830.61 },
  { name: "A5", frequency: 880.00 }
];

let isPlaying = false;
let currentNoteIndex = -1;

// Stability improvements
const SMOOTHING_FACTOR = 0.3; // Lower = smoother but more lag (0.1-0.5)
const PINCH_HYSTERESIS_THRESHOLD = 0.08; // Higher threshold to release than to trigger
let previousHandY = null;
let smoothedHandY = null;
let isPinched = false;
let pinchStateFrames = 0;
const STABLE_PINCH_FRAMES = 3; // Require 3 consecutive frames to confirm pinch state change

/*
 * 1. Load MediaPipe Hand Landmarker
 */
async function initializeHandLandmarker() {
  try {
    statusText.textContent = "Loading hand detection model...";

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/" +
          "hand_landmarker/hand_landmarker/float16/1/" +
          "hand_landmarker.task",

        delegate: "GPU"
      },

      runningMode: "VIDEO",

      numHands: 1,

      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    drawingUtils = new DrawingUtils(canvasContext);

    statusText.textContent = "Model ready";
    startButton.disabled = false;
  } catch (error) {
    console.error("MediaPipe initialization error:", error);

    statusText.textContent =
      "Failed to load hand detection model";
  }
}

/*
 * 2. Start camera
 */
startButton.addEventListener("click", async () => {
  if (!handLandmarker) {
    statusText.textContent = "Model is still loading";
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent =
      "Camera is not supported by this browser";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720
      },

      audio: false
    });

    video.srcObject = stream;

    video.addEventListener(
      "loadeddata",
      () => {
        cameraRunning = true;

        startButton.textContent = "Camera Active";
        startButton.disabled = true;

        statusText.textContent = "Show your hand";

        // Initialize audio context on user interaction
        initializeAudioContext();

        predictWebcam();
      },
      { once: true }
    );
  } catch (error) {
    console.error("Camera error:", error);

    statusText.textContent =
      "Camera permission denied or unavailable";
  }
});

/*
 * Initialize Web Audio API context
 */
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

/*
 * Play a trumpet-like sound at the given frequency
 */
function playNote(frequency, noteName) {
  if (!audioContext) {
    initializeAudioContext();
  }

  // Stop any currently playing note
  stopNote();

  // Create oscillator for the tone
  activeOscillator = audioContext.createOscillator();
  activeGainNode = audioContext.createGain();

  // Use sawtooth wave for a brass-like sound
  activeOscillator.type = "sawtooth";
  activeOscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  // Add some harmonics with a second oscillator
  const harmonicOscillator = audioContext.createOscillator();
  const harmonicGain = audioContext.createGain();
  harmonicOscillator.type = "square";
  harmonicOscillator.frequency.setValueAtTime(frequency * 2, audioContext.currentTime);
  harmonicGain.gain.setValueAtTime(0.3, audioContext.currentTime);

  // Connect oscillators to gain
  activeOscillator.connect(activeGainNode);
  harmonicOscillator.connect(harmonicGain);
  harmonicGain.connect(activeGainNode);
  activeGainNode.connect(audioContext.destination);

  // Attack envelope - quick fade in to avoid clicking
  activeGainNode.gain.setValueAtTime(0, audioContext.currentTime);
  activeGainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);

  // Start oscillators
  activeOscillator.start();
  harmonicOscillator.start();

  isPlaying = true;
  currentNoteText.textContent = noteName;
  statusText.textContent = `Playing ${noteName}`;
}

/*
 * Stop the currently playing note
 */
function stopNote() {
  if (activeGainNode && audioContext) {
    // Release envelope - quick fade out
    activeGainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);

    if (activeOscillator) {
      activeOscillator.stop(audioContext.currentTime + 0.1);
    }
  }

  activeOscillator = null;
  activeGainNode = null;
  isPlaying = false;
  currentNoteText.textContent = "—";
}

/*
 * 3. Continuously detect hands
 */
async function predictWebcam() {
  if (!cameraRunning || !handLandmarker) {
    return;
  }

  resizeCanvas();

  const currentTime = performance.now();

  let results = null;

  /*
   * Only process the video when it has moved
   * to a new frame.
   */
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    results = handLandmarker.detectForVideo(
      video,
      currentTime
    );
  }

  /*
   * Clear the previous canvas drawing.
   */
  canvasContext.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (
    results &&
    results.landmarks &&
    results.landmarks.length > 0
  ) {
    const landmarks = results.landmarks[0];

    statusText.textContent = "Hand detected";

    drawHandLandmarks(landmarks);
    checkPinchDistance(landmarks);
  } else {
    statusText.textContent = "Show your hand";

    pinchDistanceText.textContent = "—";
    currentNoteText.textContent = "—";
  }

  window.requestAnimationFrame(predictWebcam);
}

/*
 * 4. Draw hand skeleton
 */
function drawHandLandmarks(landmarks) {
  drawingUtils.drawConnectors(
    landmarks,
    HandLandmarker.HAND_CONNECTIONS,
    {
      lineWidth: 4
    }
  );

  drawingUtils.drawLandmarks(landmarks, {
    radius: 5,
    lineWidth: 2
  });
}

/*
 * 5. Calculate thumb-index distance and map to musical notes with stability improvements
 */
function checkPinchDistance(landmarks) {
  const thumbTip = landmarks[4];
  const indexFingerTip = landmarks[8];

  const distance = calculateDistance(
    thumbTip,
    indexFingerTip
  );

  pinchDistanceText.textContent =
    distance.toFixed(3);

  // Use hysteresis: different thresholds for entering vs leaving pinch state
  const enterPinchThreshold = 0.06;
  const exitPinchThreshold = PINCH_HYSTERESIS_THRESHOLD;

  // Determine if we're in a pinch state with frame confirmation
  let shouldPinch = false;

  if (distance < enterPinchThreshold && !isPinched) {
    pinchStateFrames++;
    if (pinchStateFrames >= STABLE_PINCH_FRAMES) {
      isPinched = true;
      pinchStateFrames = 0;
    }
  } else if (distance >= exitPinchThreshold && isPinched) {
    pinchStateFrames++;
    if (pinchStateFrames >= STABLE_PINCH_FRAMES) {
      isPinched = false;
      pinchStateFrames = 0;
    }
  } else {
    // Reset counter if distance is in between or state unchanged
    pinchStateFrames = 0;
    shouldPinch = isPinched;
  }

  shouldPinch = isPinched;

  // Map pinch distance to musical notes
  if (shouldPinch) {
    statusText.textContent = "Pinch detected!";

    // Get raw hand Y position and apply smoothing
    const rawHandY = landmarks[9].y; // Use middle finger MCP as reference point
    const handY = smoothHandY(rawHandY);

    // Map hand height to note index (0 to NOTES.length - 1)
    // Assuming handY ranges from ~0.2 (top) to ~0.8 (bottom)
    const normalizedHeight = Math.max(0, Math.min(1, (handY - 0.2) / 0.6));
    const noteIndex = Math.floor((1 - normalizedHeight) * NOTES.length);
    const selectedNoteIndex = Math.max(0, Math.min(NOTES.length - 1, noteIndex));
    const selectedNote = NOTES[selectedNoteIndex];

    // Only play if note changed to avoid re-triggering
    if (!isPlaying || currentNoteIndex !== selectedNoteIndex) {
      playNote(selectedNote.frequency, selectedNote.name);
      currentNoteIndex = selectedNoteIndex;
    }
  } else {
    statusText.textContent = "Hand detected";

    // Stop playing when not pinched
    if (isPlaying) {
      stopNote();
      currentNoteIndex = -1;
    }

    pinchDistanceText.textContent = distance.toFixed(3);
    currentNoteText.textContent = "—";

    // Reset smoothing when not pinched
    smoothedHandY = null;
  }
}

/*
 * Calculate 3D distance between two landmarks.
 */
function calculateDistance(pointA, pointB) {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  const deltaZ = pointA.z - pointB.z;

  return Math.sqrt(
    deltaX ** 2 +
    deltaY ** 2 +
    deltaZ ** 2
  );
}

/*
 * Apply exponential moving average smoothing to hand Y position
 */
function smoothHandY(rawY) {
  if (smoothedHandY === null) {
    smoothedHandY = rawY;
  } else {
    smoothedHandY = SMOOTHING_FACTOR * rawY + (1 - SMOOTHING_FACTOR) * smoothedHandY;
  }
  return smoothedHandY;
}

/*
 * Make canvas match the actual video dimensions.
 */
function resizeCanvas() {
  if (
    canvas.width !== video.videoWidth ||
    canvas.height !== video.videoHeight
  ) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

/*
 * Start loading MediaPipe immediately.
 */
startButton.disabled = true;
initializeHandLandmarker();