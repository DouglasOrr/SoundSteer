"use strict";

import * as physics from "./physics.js";
import * as control from "./control.js";

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
  const freqIdxMin = Math.floor(control.S.freqMin / fDelta);
  const freqIdxMax = Math.ceil(control.S.freqMax / fDelta) + 1;
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
      (screenHeight * (maxA - control.S.amplitudeThreshold)) / (maxA - minA);
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

/**
 * Draw the ship graphic.
 * @param {CanvasRenderingContext2D} ctx
 */
function drawShip(ctx) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(-1, -0.5);
  ctx.lineTo(-1, -1);
  ctx.lineTo(0, -0.5);
  ctx.lineTo(1, -1);
  ctx.lineTo(1, -0.5);
  ctx.lineTo(0, 1);
  ctx.fill();
}

/**
 * Draw the map.
 * @param {CanvasRenderingContext2D} ctx
 * @param {physics.GameMap} map
 * @returns {DOMMatrix}
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
  return ctx.getTransform();
}

/**
 * Create the interactive game.
 * @param {AudioNode} input
 * @param {physics.GameMap} map
 */
function createGame(input, map) {
  const ship = new physics.Ship(
    map.start[0].position,
    map.start[0].orientation
  );
  const keyboard = new control.Keyboard(["ArrowLeft", "ArrowUp", "ArrowRight"]);
  const microphone = new control.Microphone(input);

  const transform = drawMap(
    document.getElementById("game-bg").getContext("2d"),
    map
  );

  /** @type {CanvasRenderingContext2D} */
  const ctx = document.getElementById("game").getContext("2d");
  window.setInterval(() => {
    microphone.update();
    ship.update(
      {
        left: +(microphone.control.left || keyboard.ArrowLeft),
        forward: +(microphone.control.forward || keyboard.ArrowUp),
        right: +(microphone.control.right || keyboard.ArrowRight),
      },
      map
    );

    // Render
    ctx.resetTransform();
    ctx.clearRect(0, 0, ctx.canvas.scrollWidth, ctx.canvas.scrollHeight);
    ctx.setTransform(transform);
    ctx.translate(ship.position[0], ship.position[1]);
    ctx.rotate(ship.orientation);
    ctx.scale(1.2 * physics.S.ship.radius, 1.2 * physics.S.ship.radius);
    drawShip(ctx);
  }, 1000 * physics.S.dt);
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
      createGame(micNode, physics.GameMap.load(mapImg));
    }
  );
};
