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
 * 5. Calculate thumb-index distance
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

  /*
   * Temporary test only.
   * We will connect this to the trumpet
   * audio in the next step.
   */
  if (distance < 0.06) {
    statusText.textContent = "Pinch detected!";
    currentNoteText.textContent = "C4";
  } else {
    statusText.textContent = "Hand detected";
    currentNoteText.textContent = "—";
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