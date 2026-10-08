import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";


// ======================================================
// HTML ELEMENTS
// ======================================================

const video = document.querySelector("#webcam");
const canvas = document.querySelector("#canvas");
const canvasContext = canvas.getContext("2d");

const startButton = document.querySelector("#startButton");
const statusText = document.querySelector("#status");
const currentNoteText = document.querySelector("#currentNote");
const pinchDistanceText = document.querySelector("#pinchDistance");


// ======================================================
// MEDIAPIPE VARIABLES
// ======================================================

let handLandmarker = null;
let drawingUtils = null;

let cameraRunning = false;
let lastVideoTime = -1;


// ======================================================
// AUDIO VARIABLES
// ======================================================

let audioContext = null;

let trumpetBuffer = null;

let activeSource = null;
let activeGainNode = null;


// Our trumpet sample is C4
const BASE_FREQUENCY = 261.63;


// ======================================================
// MUSICAL NOTES
// C4 → A5
// ======================================================

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


// ======================================================
// STABILITY SETTINGS
// ======================================================

// Smaller number = smoother,
// but slightly slower response.

const SMOOTHING_FACTOR = 0.3;


// Pinch starts here

const ENTER_PINCH_THRESHOLD = 0.06;


// Pinch releases here

const EXIT_PINCH_THRESHOLD = 0.08;


// Require 3 frames before changing state

const STABLE_PINCH_FRAMES = 3;


let smoothedHandY = null;

let isPinched = false;

let pinchStateFrames = 0;


// ======================================================
// 1. INITIALIZE MEDIAPIPE
// ======================================================

async function initializeHandLandmarker() {

  try {

    statusText.textContent =
      "Loading hand detection model...";


    const vision =
      await FilesetResolver.forVisionTasks(

        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"

      );


    handLandmarker =
      await HandLandmarker.createFromOptions(

        vision,

        {

          baseOptions: {

            modelAssetPath:

              "https://storage.googleapis.com/" +
              "mediapipe-models/" +
              "hand_landmarker/" +
              "hand_landmarker/" +
              "float16/1/" +
              "hand_landmarker.task",

            delegate: "GPU"

          },


          runningMode: "VIDEO",

          numHands: 1,


          minHandDetectionConfidence: 0.5,

          minHandPresenceConfidence: 0.5,

          minTrackingConfidence: 0.5

        }

      );


    drawingUtils =
      new DrawingUtils(canvasContext);


    statusText.textContent =
      "Model ready";


    startButton.disabled = false;


  } catch (error) {

    console.error(
      "MediaPipe initialization error:",
      error
    );


    statusText.textContent =
      "Failed to load hand detection model";

  }

}


// ======================================================
// 2. START CAMERA
// ======================================================

startButton.addEventListener(
  "click",

  async () => {

    if (!handLandmarker) {

      statusText.textContent =
        "Model is still loading";

      return;

    }


    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      statusText.textContent =
        "Camera is not supported by this browser";

      return;

    }


    try {

      // Initialize audio after user interaction

      await initializeAudioContext();


      const stream =
        await navigator.mediaDevices.getUserMedia({

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


          startButton.textContent =
            "Camera Active";


          startButton.disabled = true;


          statusText.textContent =
            "Show your hand";


          predictWebcam();

        },

        { once: true }

      );


    } catch (error) {

      console.error(
        "Camera / Audio error:",
        error
      );


      statusText.textContent =
        "Camera or audio failed to start";

    }

  }

);


// ======================================================
// 3. INITIALIZE AUDIO
// ======================================================

async function initializeAudioContext() {

  if (!audioContext) {

    audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

  }


  if (
    audioContext.state === "suspended"
  ) {

    await audioContext.resume();

  }


  // Load trumpet sample only once

  if (!trumpetBuffer) {

    statusText.textContent =
      "Loading trumpet sound...";


    const response =
      await fetch(
        "./sounds/trumpet-c4.wav"
      );


    if (!response.ok) {

      throw new Error(
        "Could not find trumpet-c4.wav"
      );

    }


    const arrayBuffer =
      await response.arrayBuffer();


    trumpetBuffer =
      await audioContext.decodeAudioData(
        arrayBuffer
      );


    console.log(
      "🎺 Trumpet sample loaded!"
    );

  }

}


// ======================================================
// 4. PLAY TRUMPET NOTE
// ======================================================

function playNote(
  frequency,
  noteName
) {

  if (
    !audioContext ||
    !trumpetBuffer
  ) {

    console.warn(
      "Trumpet sample is not ready."
    );

    return;

  }


  // Stop previous note

  stopNote();


  // Create audio source

  activeSource =
    audioContext.createBufferSource();


  activeGainNode =
    audioContext.createGain();


  activeSource.buffer =
    trumpetBuffer;


  // Loop while pinching

  activeSource.loop = true;


  // ====================================================
  // PITCH SHIFT
  // ====================================================

  /*
      Original audio = C4

      C4:
      261.63 / 261.63 = 1

      C5:
      523.25 / 261.63 = 2

      Therefore playbackRate changes
      the trumpet pitch.
  */


  const playbackRate =
    frequency / BASE_FREQUENCY;


  activeSource.playbackRate
    .setValueAtTime(

      playbackRate,

      audioContext.currentTime

    );


  // ====================================================
  // VOLUME ATTACK
  // ====================================================

  const now =
    audioContext.currentTime;


  activeGainNode.gain
    .setValueAtTime(

      0,

      now

    );


  activeGainNode.gain
    .linearRampToValueAtTime(

      0.6,

      now + 0.05

    );


  // ====================================================
  // CONNECT AUDIO
  // ====================================================

  activeSource.connect(
    activeGainNode
  );


  activeGainNode.connect(
    audioContext.destination
  );


  activeSource.start();


  isPlaying = true;


  // Update UI

  currentNoteText.textContent =
    noteName;


  statusText.textContent =
    `🎺 Playing ${noteName}`;


  // Highlight pitch guide

  updatePitchGuide(
    noteName
  );

}


// ======================================================
// 5. STOP TRUMPET NOTE
// ======================================================

function stopNote() {

  if (
    activeSource &&
    activeGainNode &&
    audioContext
  ) {

    const now =
      audioContext.currentTime;


    activeGainNode.gain
      .cancelScheduledValues(
        now
      );


    activeGainNode.gain
      .setValueAtTime(

        activeGainNode.gain.value,

        now

      );


    // Small fade out

    activeGainNode.gain
      .linearRampToValueAtTime(

        0,

        now + 0.08

      );


    const sourceToStop =
      activeSource;


    setTimeout(

      () => {

        try {

          sourceToStop.stop();

        }

        catch (error) {

          // Source already stopped

        }

      },

      100

    );

  }


  activeSource = null;

  activeGainNode = null;


  isPlaying = false;


  currentNoteText.textContent =
    "—";


  clearPitchGuide();

}


// ======================================================
// 6. CAMERA DETECTION LOOP
// ======================================================

async function predictWebcam() {

  if (
    !cameraRunning ||
    !handLandmarker
  ) {

    return;

  }


  resizeCanvas();


  const currentTime =
    performance.now();


  let results = null;


  // Only detect on new video frames

  if (
    video.currentTime !==
    lastVideoTime
  ) {

    lastVideoTime =
      video.currentTime;


    results =
      handLandmarker.detectForVideo(

        video,

        currentTime

      );

  }


  // Clear previous hand skeleton

  canvasContext.clearRect(

    0,

    0,

    canvas.width,

    canvas.height

  );


  // ====================================================
  // HAND FOUND
  // ====================================================

  if (
    results &&
    results.landmarks &&
    results.landmarks.length > 0
  ) {

    const landmarks =
      results.landmarks[0];


    statusText.textContent =
      "Hand detected";


    drawHandLandmarks(
      landmarks
    );


    checkPinchDistance(
      landmarks
    );

  }


  // ====================================================
  // NO HAND
  // ====================================================

  else {

    statusText.textContent =
      "Show your hand";


    pinchDistanceText.textContent =
      "—";


    currentNoteText.textContent =
      "—";


    if (isPlaying) {

      stopNote();

    }


    currentNoteIndex = -1;

    isPinched = false;

    pinchStateFrames = 0;

    smoothedHandY = null;


    clearPitchGuide();

  }


  window.requestAnimationFrame(
    predictWebcam
  );

}


// ======================================================
// 7. DRAW HAND LANDMARKS
// ======================================================

function drawHandLandmarks(
  landmarks
) {

  drawingUtils.drawConnectors(

    landmarks,

    HandLandmarker.HAND_CONNECTIONS,

    {

      lineWidth: 4

    }

  );


  drawingUtils.drawLandmarks(

    landmarks,

    {

      radius: 5,

      lineWidth: 2

    }

  );

}


// ======================================================
// 8. PINCH DETECTION
// ======================================================

function checkPinchDistance(
  landmarks
) {

  const thumbTip =
    landmarks[4];


  const indexFingerTip =
    landmarks[8];


  const distance =
    calculateDistance(

      thumbTip,

      indexFingerTip

    );


  pinchDistanceText.textContent =
    distance.toFixed(3);


  // ====================================================
  // START PINCH
  // ====================================================

  if (
    distance <
      ENTER_PINCH_THRESHOLD &&

    !isPinched
  ) {

    pinchStateFrames++;


    if (
      pinchStateFrames >=
      STABLE_PINCH_FRAMES
    ) {

      isPinched = true;

      pinchStateFrames = 0;

    }

  }


  // ====================================================
  // RELEASE PINCH
  // ====================================================

  else if (
    distance >=
      EXIT_PINCH_THRESHOLD &&

    isPinched
  ) {

    pinchStateFrames++;


    if (
      pinchStateFrames >=
      STABLE_PINCH_FRAMES
    ) {

      isPinched = false;

      pinchStateFrames = 0;

    }

  }


  else {

    pinchStateFrames = 0;

  }


  // ====================================================
  // CURRENTLY PINCHING
  // ====================================================

  if (isPinched) {

    /*
        Landmark 9 =
        middle finger MCP.

        This is more stable than
        using the fingertip.
    */


    const rawHandY =
      landmarks[9].y;


    const handY =
      smoothHandY(
        rawHandY
      );


    // ==================================================
    // MAP HAND HEIGHT
    // ==================================================

    /*
        Camera coordinate:

        TOP
        y = 0
        ↓
        y = 1
        BOTTOM


        Useful playing range:

        0.2 → top
        0.8 → bottom
    */


    const normalizedHeight =
      Math.max(

        0,

        Math.min(

          1,

          (handY - 0.2) / 0.6

        )

      );


    // Reverse because higher hand
    // should produce higher pitch


    const noteIndex =
      Math.floor(

        (1 - normalizedHeight) *
        NOTES.length

      );


    const selectedNoteIndex =
      Math.max(

        0,

        Math.min(

          NOTES.length - 1,

          noteIndex

        )

      );


    const selectedNote =
      NOTES[
        selectedNoteIndex
      ];


    // ==================================================
    // PLAY ONLY WHEN NOTE CHANGES
    // ==================================================

    if (
      !isPlaying ||

      currentNoteIndex !==
        selectedNoteIndex
    ) {

      playNote(

        selectedNote.frequency,

        selectedNote.name

      );


      currentNoteIndex =
        selectedNoteIndex;

    }

  }


  // ====================================================
  // NOT PINCHING
  // ====================================================

  else {

    statusText.textContent =
      "Hand detected";


    if (isPlaying) {

      stopNote();

    }


    currentNoteIndex = -1;


    currentNoteText.textContent =
      "—";


    smoothedHandY = null;


    clearPitchGuide();

  }

}


// ======================================================
// 9. CALCULATE LANDMARK DISTANCE
// ======================================================

function calculateDistance(
  pointA,
  pointB
) {

  const deltaX =
    pointA.x - pointB.x;


  const deltaY =
    pointA.y - pointB.y;


  const deltaZ =
    pointA.z - pointB.z;


  return Math.sqrt(

    deltaX ** 2 +

    deltaY ** 2 +

    deltaZ ** 2

  );

}


// ======================================================
// 10. SMOOTH HAND MOVEMENT
// ======================================================

function smoothHandY(
  rawY
) {

  if (
    smoothedHandY === null
  ) {

    smoothedHandY =
      rawY;

  }

  else {

    smoothedHandY =

      SMOOTHING_FACTOR *
      rawY +

      (
        1 -
        SMOOTHING_FACTOR
      ) *
      smoothedHandY;

  }


  return smoothedHandY;

}


// ======================================================
// 11. UPDATE PITCH GUIDE
// ======================================================

function updatePitchGuide(
  noteName
) {

  const pitchNotes =
    document.querySelectorAll(
      ".pitch-note"
    );


  // Remove previous highlight

  pitchNotes.forEach(
    (element) => {

      element.classList.remove(
        "active"
      );

    }
  );


  // ====================================================
  // EXACT NOTE
  // ====================================================

  let target =
    document.querySelector(

      `.pitch-note[data-note="${noteName}"]`

    );


  // ====================================================
  // SHARP NOTE
  // ====================================================

  /*
      Pitch guide only displays
      natural notes.

      Example:

      F#4 → highlight F4
      G#4 → highlight G4
  */


  if (!target) {

    const naturalNote =
      noteName.replace(
        "#",
        ""
      );


    target =
      document.querySelector(

        `.pitch-note[data-note="${naturalNote}"]`

      );

  }


  if (target) {

    target.classList.add(
      "active"
    );

  }

}


// ======================================================
// 12. CLEAR PITCH GUIDE
// ======================================================

function clearPitchGuide() {

  const pitchNotes =
    document.querySelectorAll(
      ".pitch-note"
    );


  pitchNotes.forEach(
    (element) => {

      element.classList.remove(
        "active"
      );

    }
  );

}


// ======================================================
// 13. RESIZE CANVAS
// ======================================================

function resizeCanvas() {

  if (

    canvas.width !==
      video.videoWidth ||

    canvas.height !==
      video.videoHeight

  ) {

    canvas.width =
      video.videoWidth;


    canvas.height =
      video.videoHeight;

  }

}


// ======================================================
// START PROGRAM
// ======================================================

startButton.disabled = true;

initializeHandLandmarker();