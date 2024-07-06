window.onload = () => {
  navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => {
    // Audio
    const audioCtx = new AudioContext();
    const src = new MediaStreamAudioSourceNode(audioCtx, {
      mediaStream: stream,
    });
    const analyser = new AnalyserNode(audioCtx, {
      fftSize: 4096,
      smoothingTimeConstant: 0.2,
    });
    src.connect(analyser);

    // Canvas
    const canvas = document.getElementById("screen");
    const { width: screenWidth, height: screenHeight } =
      canvas.getBoundingClientRect();
    /** @type {CanvasRenderingContext2D} */
    const gctx = canvas.getContext("2d");
    gctx.fillStyle = "#6a9";

    const minA = -120;
    const maxA = -30;
    const nBins = 512;

    const freqData = new Float32Array(analyser.frequencyBinCount);
    setInterval(() => {
      analyser.getFloatFrequencyData(freqData);
      gctx.clearRect(0, 0, screenWidth, screenHeight);
      const dw = screenWidth / nBins;
      const dh = screenHeight / (maxA - minA);
      for (let i = 0; i < nBins; ++i) {
        const h = (freqData[i] - minA) * dh;
        gctx.fillRect(i * dw, screenHeight - h, dw, h);
      }
    }, 100);
  });
};
