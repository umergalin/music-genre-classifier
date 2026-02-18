export class WavePlotter {
  #container;
  #canvas;
  #ctx;

  #rmsHistory = [];

  #WAVEFORM_STYLE = {
    color: '#D9D9D9',
    delimiterSize: 3,
    spacingSize: 3,
  };

  constructor(container) {
    this.#container = container;

    this.#canvas = document.createElement("canvas");
    container.append(this.#canvas);

    this.#ctx = this.#canvas.getContext('2d');
  }

  #recordRMS(audioBuffer, stepSize, stepCount) {
    const rms = this.#calculateRMS(audioBuffer, stepSize, stepCount);
    this.#rmsHistory = rms;
  }

  #calculateRMS(audioBuffer, stepSize, stepCount) {
    const numChannels = audioBuffer.numberOfChannels;
    const bufferLength = audioBuffer.length;
    const rmsValues = [];

    const channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    for (let i = 0; i < stepCount; i++) {
      const start = i * stepSize;
      const end = Math.min(start + stepSize, bufferLength);

      let totalSumSquares = 0;
      let count = 0;

      for (let ch = 0; ch < numChannels; ch++) {
        const data = channels[ch];
        for (let j = start; j < end; j++) {
          const val = data[j];
          totalSumSquares += val * val;
          count++;
        }
      }

      const rms = count > 0 ? Math.sqrt(totalSumSquares / count) : 0;
      rmsValues.push(rms);
    }

    return rmsValues;
  }

  #drawBackgroundWaveform() {
    const { color, delimiterSize, spacingSize } = this.#WAVEFORM_STYLE;

    const width = this.#container.clientWidth;
    const height = this.#container.clientHeight;

    const start = performance.now();
    console.log(`Рисую график на полотне размером ${width}x${height}`);

    const centerY = height / 2;

    const maxRMS = this.#rmsHistory.reduce((max, val) => val > max ? val : max);
    const scaleFactor = maxRMS > 0 ? 1 / maxRMS : 1;

    const minDelimiterHeight = 1;
    this.#ctx.lineWidth = delimiterSize;
    this.#ctx.strokeStyle = color;
    this.#ctx.beginPath();

    for (let i = 0; i < this.#rmsHistory.length; i++) {
      const normalizedHeight = this.#rmsHistory[i] * scaleFactor;
      const x = i * (delimiterSize + spacingSize) + delimiterSize / 2;
      let barHeight = normalizedHeight * centerY;

      if (barHeight < minDelimiterHeight) barHeight = minDelimiterHeight;

      this.#ctx.moveTo(x, centerY - barHeight);
      this.#ctx.lineTo(x, centerY + barHeight);
    }

    this.#ctx.stroke();

    const end = performance.now();
    console.log(`График нарисован за ${(end - start).toFixed(3)} мс`);
  }

  setupCanvas(audioBuffer) {
    this.#updateSize();
    this.#clearCanvas();

    const { color, delimiterSize, spacingSize } = this.#WAVEFORM_STYLE;

    const width = this.#container.clientWidth;

    const stepCount = Math.floor((width + spacingSize) / (delimiterSize + spacingSize)); // сколько вообще делений помещается на график
    const totalSamples = audioBuffer.length;
    const stepSize = Math.ceil(totalSamples / stepCount); // количество сэмплов на 1 деление
    console.log("Шаг: " + stepSize);

    this.#recordRMS(audioBuffer, stepSize, stepCount);

    this.#drawBackgroundWaveform();
  }

  #clearCanvas() {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
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
}