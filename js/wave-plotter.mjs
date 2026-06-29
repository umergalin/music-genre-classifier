export class WavePlotter {
  #container;
  #canvas;
  #ctx;

  #resizeObserver;
  #isResizing = false;
  #resizeTimer = null;
  #frameRequested = false;

  #channels = null;

  #rmsHistory = [];
  #scaleFactor = 1;

  #segments = [];

  #WAVEFORM_STYLE = {
    color: "#D9D9D9",
    delimiterSize: 3,
    spacingSize: 3,
  };

  constructor(container) {
    this.#container = container;

    this.#canvas = document.createElement("canvas");
    container.append(this.#canvas);

    this.#ctx = this.#canvas.getContext("2d");

    this.#initResizeObserver();
  }

  #initResizeObserver() {
    this.#resizeObserver = new ResizeObserver((entries) => {
      this.#isResizing = true;

      clearTimeout(this.#resizeTimer);
      this.#resizeTimer = setTimeout(() => {
        this.#isResizing = false;
        this.render();
      }, 200);

      if (!this.#frameRequested) {
        this.#frameRequested = true;
        requestAnimationFrame(() => {
          this.render();
          this.#frameRequested = false;
        });
      }
    });

    this.#resizeObserver.observe(this.#container);
  }

  destroy() {
    this.#resizeObserver.disconnect();
    this.#canvas.remove();
  }

  #computeRMS(stepSize, stepCount) {
    const rms = this.#calculateRMS(stepSize, stepCount);
    this.#rmsHistory = rms;

    const maxRMS = rms.reduce((max, val) => (val > max ? val : max));
    this.#scaleFactor = maxRMS > 0 ? 1 / maxRMS : 1;
  }

  #calculateRMS(stepSize, stepCount) {
    const numChannels = this.#channels.length;
    const bufferLength = this.#channels[0].length;
    const rmsValues = new Float32Array(stepCount);

    const sampleStride = this.#isResizing ? 10 : 1;

    for (let i = 0; i < stepCount; i++) {
      const start = i * stepSize;
      const end = Math.min(start + stepSize, bufferLength);

      let totalSumSquares = 0;
      let count = 0;

      for (let ch = 0; ch < numChannels; ch++) {
        const data = this.#channels[ch];
        for (let j = start; j < end; j += sampleStride) {
          const val = data[j];
          totalSumSquares += val * val;
          count++;
        }
      }
      rmsValues[i] = count > 0 ? totalSumSquares / count : 0;
    }

    return rmsValues;
  }

  #drawWaveform() {
    if (this.#segments.length === 0) {
      this.#drawRMS(0, this.#rmsHistory.length, this.#WAVEFORM_STYLE.color);
      return;
    }

    for (const segment of this.#segments) {
      this.#drawRMS(segment.start, segment.end, segment.color);
    }
  }

  #drawRMS(fromIndex, toIndex, color = this.#WAVEFORM_STYLE.color) {
    const { delimiterSize, spacingSize } = this.#WAVEFORM_STYLE;

    const height = this.#canvas.height / (window.devicePixelRatio || 1);
    const centerY = height / 2;

    this.#ctx.lineWidth = delimiterSize;
    this.#ctx.strokeStyle = color;
    this.#ctx.beginPath();

    for (let i = fromIndex; i < toIndex; i++) {
      const normalizedHeight = this.#rmsHistory[i] * this.#scaleFactor;
      const x = i * (delimiterSize + spacingSize) + delimiterSize / 2;

      let barHeight = Math.max(normalizedHeight * centerY, 1);

      this.#ctx.moveTo(x, centerY - barHeight);
      this.#ctx.lineTo(x, centerY + barHeight);
    }

    this.#ctx.stroke();
  }

  #toggleShow(toShow) {
    this.#container.classList.toggle("show", toShow);
  }

  render(audioBuffer) {
    if (audioBuffer && !this.#channels) {
      this.#channels = [];
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        this.#channels.push(audioBuffer.getChannelData(ch));
      }
    }

    if (!this.#channels) return;

    const { delimiterSize, spacingSize } = this.#WAVEFORM_STYLE;
    const width = this.#container.clientWidth;
    const stepCount = Math.floor(
      (width + spacingSize) / (delimiterSize + spacingSize),
    ); // сколько вообще делений помещается на график

    if (stepCount !== this.#rmsHistory.length) {
      const totalSamples = this.#channels[0].length;
      const stepSize = Math.ceil(totalSamples / stepCount);

      this.#updateSize();
      this.#computeRMS(stepSize, stepCount);
    } else {
      this.#clearAndHide();
    }

    this.#drawWaveform();
    this.#toggleShow(true);
  }

  #clearAndHide() {
    this.#toggleShow(false);
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  reset() {
    this.#segments = [];
    this.#clearAndHide();
  }

  #updateSize() {
    this.#canvas.width = this.#container.clientWidth;
    this.#canvas.height = this.#container.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.#canvas;

    const width = Math.floor(clientWidth * dpr);
    const height = Math.floor(clientHeight * dpr);

    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;

      this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  setSegmentsCount(count) {
    const oldCount = this.#segments.length;

    this.#segments = Array.from(Array(count), () => ({
      start: 0,
      end: 0,
      color: this.#WAVEFORM_STYLE.color,
    }));

    if (oldCount !== count) this.#calculateSegments();
  }

  #calculateSegments() {
    const barsCount = this.#rmsHistory.length;
    const segmentCount = this.#segments.length;

    if (segmentCount === 0) return;

    const step = barsCount / segmentCount;
    let currentPos = 0;

    this.#segments.forEach((segment, i) => {
      segment.start = Math.round(currentPos);
      currentPos += step;
      segment.end = i === segmentCount - 1 ? barsCount : Math.round(currentPos);
    });
  }

  setSegmentColor(index, color) {
    if (this.#segments[index]) {
      this.#segments[index].color = color;
      this.#drawWaveform();
    }
  }
}