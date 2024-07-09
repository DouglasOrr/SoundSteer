"use strict";

const FreqMin = 350;
const FreqMax = 2 * FreqMin;
const AmplitudeThreshold = -60;

/**
 * Create the live FFT frequency scope.
 * @param {AudioNode} input
 */
function createScope(input) {
  const analyser = new AnalyserNode(input.context, {
    fftSize: 4096,
    smoothingTimeConstant: 0.2,
  });
  input.connect(analyser);
  /** @type {CanvasRenderingContext2D} */
  const ctx = document.getElementById("scope").getContext("2d");
  ctx.fillStyle = "#6a9";
  const minA = -80;
  const maxA = -20;
  const nBins = 256;
  const freqData = new Float32Array(nBins);
  const fDelta = analyser.context.sampleRate / (2 * analyser.fftSize);
  const freqIdxMin = Math.floor(FreqMin / fDelta);
  const freqIdxMax = Math.ceil(FreqMax / fDelta) + 1;
  setInterval(() => {
    analyser.getFloatFrequencyData(freqData);
    const { width: screenWidth, height: screenHeight } =
      ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, screenWidth, screenHeight);
    const dw = screenWidth / nBins;
    const dh = screenHeight / (maxA - minA);

    for (let i = 0; i < nBins; ++i) {
      const h = (freqData[i] - minA) * dh;
      ctx.fillRect(i * dw, screenHeight - h, dw, h);
    }

    ctx.beginPath();
    const thresholdY =
      (screenHeight * (maxA - AmplitudeThreshold)) / (maxA - minA);
    ctx.moveTo(freqIdxMin * dw, thresholdY);
    ctx.lineTo((freqIdxMax - 1) * dw, thresholdY);
    ctx.strokeStyle = "#ff000088";
    ctx.stroke();
    ctx.beginPath();
    [
      freqIdxMin,
      freqIdxMin + (1 / 3) * (freqIdxMax - 1 - freqIdxMin),
      freqIdxMin + (2 / 3) * (freqIdxMax - 1 - freqIdxMin),
      freqIdxMax - 1,
    ].forEach((i) => {
      ctx.moveTo(i * dw, 0);
      ctx.lineTo(i * dw, screenHeight);
    });
    ctx.strokeStyle = "#6666aa88";
    ctx.stroke();
  }, 100);
}

class GameMap {
  /**
   * @param {number} width
   * @param {number} height
   * @param {Array<boolean>} walls
   */
  constructor(width, height, walls) {
    this.width = width;
    this.height = height;
    this.walls = walls;
  }

  /**
   * @param {ImageData} data
   * @returns {GameMap}
   */
  static load(img) {
    const data32 = new Uint32Array(img.data.buffer);
    const walls = new Array(img.height * img.width);
    for (let j = 0; j < img.height; ++j) {
      for (let i = 0; i < img.width; ++i) {
        const px = data32[j * img.width + i];
        walls[j * img.width + i] = px == 0xff000000;
      }
    }
    return new GameMap(img.width, img.height, walls);
  }
}

/**
 * Draw the ship graphic.
 * @param {CanvasRenderingContext2D} ctx
 */
function drawShip(ctx) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-10, -5);
  ctx.lineTo(-10, -10);
  ctx.lineTo(0, -5);
  ctx.lineTo(10, -10);
  ctx.lineTo(10, -5);
  ctx.lineTo(0, 10);
  ctx.fill();
}

/**
 * Draw the map.
 * @param {CanvasRenderingContext2D} ctx
 * @param {GameMap} map
 */
function drawMap(ctx, map) {
  const { width, height } = ctx.canvas.getBoundingClientRect();
  const scale = Math.min(width / map.width, height / map.height);
  ctx.translate(
    (width - scale * map.width) / 2,
    (height - scale * map.height) / 2
  );
  ctx.scale(scale, scale);
  ctx.fillStyle = window.getComputedStyle(ctx.canvas).color;
  for (let j = 0; j < map.height; ++j) {
    for (let i = 0; i < map.width; ++i) {
      if (map.walls[j * map.width + i]) {
        ctx.fillRect(i, j, 1, 1);
      }
    }
  }
}

/**
 * Create the interactive game.
 * @param {AudioNode} input
 * @param {GameMap} map
 */
function createGame(input, map) {
  // Audio input
  const analyser = new AnalyserNode(input.context, {
    fftSize: 4096,
    smoothingTimeConstant: 0,
  });
  input.connect(analyser);
  const fDelta = analyser.context.sampleRate / (2 * analyser.fftSize);
  const freqIdxMin = Math.floor(FreqMin / fDelta);
  const freqIdxMax = Math.ceil(FreqMax / fDelta) + 1;
  const freqData = new Float32Array(freqIdxMax); // k * sampleRate / (2 * windowSize)

  // Keyboard input
  const keys = { left: false, right: false, up: false };
  /** @param {KeyboardEvent} e */
  function handleKey(e) {
    if (e.key === "ArrowLeft") keys.left = e.type === "keydown";
    if (e.key === "ArrowRight") keys.right = e.type === "keydown";
    if (e.key === "ArrowUp") keys.up = e.type === "keydown";
  }
  document.addEventListener("keydown", handleKey);
  document.addEventListener("keyup", handleKey);

  // Physics & main loop
  let shipPosition = [384, 384];
  let shipVelocity = [0, 0];
  let shipOrientation = Math.PI;
  let shipAngularVelocity = 0;
  let shipThrust = 200;
  let shipAngularThrust = 8;
  let dt = 0.01;
  let velocityHalfLife = 0.5;
  let angularVelocityHalfLife = 0.2;

  drawMap(document.getElementById("game-bg").getContext("2d"), map);

  /** @type {CanvasRenderingContext2D} */
  const ctx = document.getElementById("game").getContext("2d");
  window.setInterval(() => {
    // Control
    let controlLeft = false;
    let controlRight = false;
    let controlForward = false;

    analyser.getFloatFrequencyData(freqData);
    let bestValue = -Infinity;
    let bestIdx = 0;
    for (let i = freqIdxMin; i < freqIdxMax; ++i) {
      if (freqData[i] > bestValue) {
        bestValue = freqData[i];
        bestIdx = i;
      }
    }
    if (bestValue > AmplitudeThreshold) {
      const idx = Math.floor(
        (3 * (bestIdx - freqIdxMin)) / (freqIdxMax - 1 - freqIdxMin)
      );
      // console.log(idx, [freqIdxMin, bestIdx, freqIdxMax], bestValue);
      controlLeft = idx === 0;
      controlForward = idx === 1;
      controlRight = idx === 2;
    }
    controlLeft = controlLeft || keys.left;
    controlRight = controlRight || keys.right;
    controlForward = controlForward || keys.up;

    // Physics
    shipVelocity[0] *= Math.pow(0.5, dt / velocityHalfLife);
    shipVelocity[1] *= Math.pow(0.5, dt / velocityHalfLife);
    const deltaVelocity =
      (1 * controlForward + 0.5 * controlLeft + 0.5 * controlRight) *
      dt *
      shipThrust;
    shipVelocity[0] += deltaVelocity * -Math.sin(shipOrientation);
    shipVelocity[1] += deltaVelocity * Math.cos(shipOrientation);
    shipPosition[0] += dt * shipVelocity[0];
    shipPosition[1] += dt * shipVelocity[1];

    shipAngularVelocity *= Math.pow(0.5, dt / angularVelocityHalfLife);
    shipAngularVelocity +=
      (controlRight - controlLeft) * dt * shipAngularThrust;
    shipOrientation += dt * shipAngularVelocity;

    // Render
    ctx.resetTransform();
    ctx.clearRect(0, 0, ctx.canvas.scrollWidth, ctx.canvas.scrollHeight);
    ctx.translate(shipPosition[0], shipPosition[1]);
    ctx.rotate(shipOrientation);
    drawShip(ctx);
  }, 1000 * dt);
}

/**
 * @param {String} path
 * @returns {Promise<ImageData>}
 */
function loadImageData(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function () {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.drawImage(this, 0, 0);
      resolve(ctx.getImageData(0, 0, this.width, this.height, {}));
    };
    img.src = path;
  });
}

/**
 * @returns {MediaStreamAudioSourceNode}
 */
async function loadMicrophone() {
  const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
  return new AudioContext().createMediaStreamSource(stream);
}

// Start everything.
window.onload = () => {
  Promise.all([loadMicrophone(), loadImageData("maps/simple.png")]).then(
    ([micNode, mapImg]) => {
      createScope(micNode);
      createGame(micNode, GameMap.load(mapImg));
    }
  );
};
