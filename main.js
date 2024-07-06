"use strict";

const FreqMin = 440;
const FreqMax = 880;
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

window.onload = () => {
  navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => {
    const audioCtx = new AudioContext();
    const micNode = new MediaStreamAudioSourceNode(audioCtx, {
      mediaStream: stream,
    });
    createScope(micNode);

    const analyser = new AnalyserNode(micNode.context, {
      fftSize: 4096,
      smoothingTimeConstant: 0,
    });
    micNode.connect(analyser);
    const fDelta = analyser.context.sampleRate / (2 * analyser.fftSize);
    const freqIdxMin = Math.floor(FreqMin / fDelta);
    const freqIdxMax = Math.ceil(FreqMax / fDelta) + 1;
    const freqData = new Float32Array(freqIdxMax); // k * sampleRate / (2 * windowSize)

    const keys = { left: false, right: false, up: false };
    /** @param {KeyboardEvent} e */
    function handleKey(e) {
      if (e.key === "ArrowLeft") keys.left = e.type === "keydown";
      if (e.key === "ArrowRight") keys.right = e.type === "keydown";
      if (e.key === "ArrowUp") keys.up = e.type === "keydown";
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("keyup", handleKey);

    /** @type {CanvasRenderingContext2D} */
    const ctx = document.getElementById("game").getContext("2d");

    let shipPosition = [256, 256];
    let shipVelocity = [0, 0];
    let shipOrientation = Math.PI;
    let shipAngularVelocity = 0;
    let shipThrust = 200;
    let shipAngularThrust = 8;
    let dt = 0.01;
    let velocityHalfLife = 0.5;
    let angularVelocityHalfLife = 0.2;

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
  });
};
