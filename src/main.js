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
  const minA = -100;
  const maxA = -20;
  const nBins = 256;
  const freqData = new Float32Array(nBins);
  const fDelta = analyser.context.sampleRate / (2 * analyser.fftSize);
  const freqIdxMin = Math.floor(
    (control.S.freqMid - control.S.freqHalfRange) / fDelta
  );
  const freqIdxMax =
    Math.ceil((control.S.freqMid + control.S.freqHalfRange) / fDelta) + 1;
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
 * @param {physics.Ship} ship
 */
function drawShip(ctx, ship) {
  ctx.translate(ship.position[0], ship.position[1]);
  ctx.rotate(ship.orientation);
  ctx.scale(1.2 * physics.S.ship.radius, 1.2 * physics.S.ship.radius);
  ctx.beginPath();
  ctx.fillStyle = "#fa0";
  if (ship.control.forward || ship.control.left) {
    ctx.ellipse(-0.6, -1, 0.4, 1.8, 0, Math.PI, 2 * Math.PI);
  }
  if (ship.control.forward || ship.control.right) {
    ctx.ellipse(0.6, -1, 0.4, 1.8, 0, Math.PI, 2 * Math.PI);
  }
  ctx.fill();
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
 * @param {number} t_ms
 * @returns {string}
 */
function formatLapTime(t_ms) {
  return (t_ms / 1000).toFixed(1);
}

class LapTimeCounter {
  /**
   * @param {physics.Ship} ship
   */
  constructor(ship) {
    this.ship = ship;
    this.label = document.getElementById("lap-time");
    this.lastLapTime = null;
    this.bestLapTime = null;
    const s = window.localStorage.getItem("bestLapTime");
    if (s) {
      this.bestLapTime = parseFloat(s);
    }
    ship.lapTimeListeners.push((t) => {
      this.lastLapTime = t;
      if (this.bestLapTime === null || t < this.bestLapTime) {
        this.bestLapTime = t;
        window.localStorage.setItem("bestLapTime", t);
      }
    });

    document
      .getElementById("settings-reset-best-lap")
      .addEventListener("click", () => {
        window.localStorage.removeItem("bestLapTime");
        this.bestLapTime = null;
      });
  }

  update() {
    const current = this.ship.lapStartTime
      ? formatLapTime(Date.now() - this.ship.lapStartTime)
      : "--";
    const last = this.lastLapTime ? formatLapTime(this.lastLapTime) : "--";
    const best = this.bestLapTime ? formatLapTime(this.bestLapTime) : "--";
    const text = `${current} s  |  last: ${last} s  |  best: ${best} s`;
    this.label.innerHTML = text;
  }
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
  const lapTimeCounter = new LapTimeCounter(ship);
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
    drawShip(ctx, ship);

    // Lap time
    lapTimeCounter.update();
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
 * @returns {Promise<MediaStreamAudioSourceNode>}
 */
function loadMicrophone() {
  return new Promise((resolve) => {
    const ctx = new AudioContext();
    function finish() {
      navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => {
        resolve(ctx.createMediaStreamSource(stream));
      });
    }
    if (ctx.state === "running") {
      finish();
    } else {
      document.body.addEventListener(
        "click",
        () => {
          ctx.resume().then(finish);
        },
        { once: true }
      );
    }
  });
}

function setupSettings() {
  // Make the expanded state "sticky"
  const settingsPanel = document.getElementById("settings");
  if (window.localStorage.getItem("settingsExpanded") === "true") {
    settingsPanel.setAttribute("open", "");
  }
  settingsPanel.addEventListener("toggle", () => {
    window.localStorage.setItem(
      "settingsExpanded",
      settingsPanel.hasAttribute("open")
    );
  });

  const keys = ["freqMid", "freqHalfRange", "amplitudeThreshold"];
  keys.forEach((key) => {
    const setting = window.localStorage.getItem(key);
    if (setting !== null) {
      control.S[key] = parseFloat(setting);
    }
    document.getElementById(`settings-${key}`).value = control.S[key];
  });
  document
    .getElementById("settings-reset-settings")
    .addEventListener("click", () => {
      keys.forEach((key) => {
        window.localStorage.setItem(key, control.S_default[key]);
      });
      window.location.reload();
    });
  document.getElementById("settings-apply").addEventListener("click", () => {
    keys.forEach((key) => {
      window.localStorage.setItem(
        key,
        document.getElementById(`settings-${key}`).value
      );
    });
    window.location.reload();
  });
}

// Start everything.
window.onload = () => {
  setupSettings();
  Promise.all([loadMicrophone(), loadImageData("maps/simple.png")]).then(
    ([micNode, mapImg]) => {
      document.getElementById("click-to-start").style.display = "none";
      createScope(micNode);
      createGame(micNode, physics.GameMap.load(mapImg));
    }
  );
};
