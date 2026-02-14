export class WavePlotter {
  #container;
  #canvas;
  #segmentsColor;
  #WAVEFORM_STYLE = {
    color: '#D9D9D9',
    delimiterSize: 3,
    spacingSize: 3,
  };

  constructor(container) {
    this.#container = container;

    this.#canvas = document.createElement("canvas");
    container.append(this.#canvas);
  }

  drawPlaceholder(audioBuffer) {
    const { color, delimiterSize, spacingSize } = this.#WAVEFORM_STYLE;

    const width = this.#container.clientWidth;
    const height = this.#container.clientHeight;
    this.#canvas.width = this.#container.clientWidth;
    this.#canvas.height = this.#container.clientHeight;

    const ctx = this.#canvas.getContext('2d');

    this.resizeCanvas(this.#canvas, ctx);

    const start = performance.now();
    ctx.clearRect(0, 0, width, height);

    const delimiterCount = Math.floor((width + spacingSize) / (delimiterSize + spacingSize)); // сколько вообще делений помещается на график

    console.log(`Рисую график на полотне размером ${width}x${height}`);

    const channelData = audioBuffer.getChannelData(0); // берем первый канал
    const step = Math.ceil(channelData.length / delimiterCount); // количество сэмплов на 1 деление
    console.log("Шаг: " + step);
    const centerY = height / 2;

    const rmsValues = [];
    let maxRMS = 0;

    // 1. Один проход для сбора данных
    for (let i = 0; i < delimiterCount; i++) {
      const start = i * step;
      let sumOfSquares = 0;
      let count = 0;

      for (let j = 0; j < step && (start + j) < channelData.length; j++) {
        const val = channelData[start + j];
        sumOfSquares += val * val;
        count++;
      }

      const rms = Math.sqrt(sumOfSquares / count);
      if (rms > maxRMS) maxRMS = rms;
      rmsValues.push(rms); // Сохраняем, чтобы не считать заново
    }

    const scaleFactor = maxRMS > 0 ? 1 / maxRMS : 1;

    const minDelimiterHeight = 1;
    ctx.lineWidth = delimiterSize;
    ctx.strokeStyle = color;
    ctx.beginPath();

    for (let i = 0; i < rmsValues.length; i++) {
      const normalizedHeight = rmsValues[i] * scaleFactor;
      const x = i * (delimiterSize + spacingSize) + delimiterSize / 2;
      let height = normalizedHeight * centerY;

      if (height < minDelimiterHeight) height = minDelimiterHeight;

      // Рисуем линию
      ctx.moveTo(x, centerY - height);
      ctx.lineTo(x, centerY + height);
    }

    ctx.stroke();

    const end = performance.now();
    console.log(`График нарисован за ${(end - start).toFixed(3)} мс`);
  }

  markSegment(segmentNum, color) {

  }

  clear() {
    this.#canvas.getContext('2d').clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.#canvas;

    const width = Math.floor(clientWidth * dpr);
    const height = Math.floor(clientHeight * dpr);

    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;

      this.#canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
}