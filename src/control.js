"use strict";

export const S = {
  freqMin: 400,
  freqMax: 800,
  amplitudeThreshold: -60,
};

/**
 * Monitor the mic for pitch-based control.
 */
export class Microphone {
  /**
   * @param {AudioNode} input
   */
  constructor(input) {
    this.analyser = new AnalyserNode(input.context, {
      fftSize: 4096,
      smoothingTimeConstant: 0,
    });
    input.connect(this.analyser);
    const fDelta =
      this.analyser.context.sampleRate / (2 * this.analyser.fftSize);
    this.idxMin = Math.floor(S.freqMin / fDelta);
    this.idxMax = Math.ceil(S.freqMax / fDelta + 1);
    this.data = new Float32Array(this.idxMax); // k * sampleRate / (2 * windowSize)
    this.control = { left: false, forward: false, right: false };
  }

  update() {
    this.analyser.getFloatFrequencyData(this.data);
    let bestValue = -Infinity;
    let bestIdx = 0;
    for (let i = this.idxMin; i < this.idxMax; ++i) {
      if (this.data[i] > bestValue) {
        bestValue = this.data[i];
        bestIdx = i;
      }
    }
    const idx =
      bestValue > S.amplitudeThreshold
        ? Math.floor(
            (3 * (bestIdx - this.idxMin)) / (this.idxMax - 1 - this.idxMin)
          )
        : -1;
    this.control.left = idx === 0;
    this.control.forward = idx === 1;
    this.control.right = idx === 2;
  }
}

/**
 * Maintains the state of specific, to support polling.
 */
export class Keyboard {
  /**
   *
   * @param {Array<String>} keys
   */
  constructor(keys) {
    this.keys = keys;
    keys.forEach((key) => {
      this[key] = false;
    });
    document.addEventListener("keydown", this._handleKey.bind(this));
    document.addEventListener("keyup", this._handleKey.bind(this));
  }

  /**
   * @param {KeyboardEvent} e
   */
  _handleKey(e) {
    if (this.keys.includes(e.key)) {
      this[e.key] = e.type === "keydown";
    }
  }
}
