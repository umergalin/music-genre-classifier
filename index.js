import { BubbleChart } from './bubble-chart.mjs';
import { streamPredictions } from './audio-processor.mjs';

console.log("hi");

const MODEL_PATH = '/model/model.json';

//const GENRES = ['Блюз', 'Классическая', 'Кантри', 'Диско', 'Хип-хоп', 'Джаз', 'Метал', 'Поп', 'Регги', 'Рок'];
const GENRES = ["blues", "classical", "country", "disco", "hiphop", "jazz", "metal", "pop", "reggae", "rock"];

const GENRES_TRANSLATION = {
  "blues": "блюз",
  "classical": "классическая",
  "country": "кантри",
  "disco": "диско",
  "hiphop": "хип-хоп",
  "jazz": "джаз",
  "metal": "метал",
  "pop": "поп",
  "reggae": "регги",
  "rock": "рок"
}

const GENRES_EMOJIS = {
  "blues": "🎺",
  "classical": "🎹",
  "country": "🤠",
  "disco": "💿",
  "hiphop": "🎛️",
  "jazz": "🎷",
  "metal": "💀",
  "pop": "🎤",
  "reggae": "☮️",
  "rock": "🎸"
}

const WAVEFORM_STYLE = {
  color: '#D9D9D9',
  delimiterSize: 3,
  spacingSize: 3,
};

let model = null;

const bubbleChartContainer = document.querySelector('.bubble-chart');
const bubbleChart = new BubbleChart(bubbleChartContainer, GENRES_TRANSLATION, GENRES_EMOJIS);

const audioFileInput = document.getElementById('audio-file-input');
const runAnalysisButton = document.querySelector('.js-run-analysis');

const pageInput = document.querySelector('.page-input');
const pageResult = document.querySelector('.page-result');

const contentContainer = document.getElementById('content-container')
const backToInputButton = document.querySelector('.js-back-trigger');
const waveformOutput = document.querySelector('.js-waveform-canvas')

const nameOutput = document.querySelector('.metadata .name');
const authorOutput = document.querySelector('.metadata .author');

const resultOutput = document.querySelector('.result .genre');

const loader = document.querySelector('.loader');

async function modelLoad() {
  model = await tf.loadLayersModel(MODEL_PATH);
  console.log("model loaded");

  const inputShape = model.inputs[0].shape;
  console.log('Размерность входа:', inputShape);
}

async function loadAudio(file) {
  const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();

  try {
    console.log(`Декодирование ${file.name}`);

    const arrayBuffer = await file.arrayBuffer();
    let audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);

    return audioBuffer;
  } catch (err) {
    console.warn('Ошибка при чтении файла', file.name, err);
  }
}

function resizeCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth, clientHeight } = canvas;

  const width = Math.floor(clientWidth * dpr);
  const height = Math.floor(clientHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function drawWaveplot(audioBuffer) {
  const { color, delimiterSize, spacingSize } = WAVEFORM_STYLE;

  const width = waveformOutput.clientWidth;
  const height = waveformOutput.clientHeight;
  waveformOutput.width = waveformOutput.clientWidth;
  waveformOutput.height = waveformOutput.clientHeight;

  const ctx = waveformOutput.getContext('2d');

  resizeCanvas(waveformOutput, ctx);

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

function displayTrackInfo(file) {
  authorOutput.textContent = 'Неизвестен';
  nameOutput.textContent = 'Неизвестно';

  const fileName = file.name;

  const lastDotIndex = fileName.lastIndexOf('.');
  const trackTitle = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;

  const separatorIndex = trackTitle.indexOf('-');

  if (separatorIndex !== -1) {
    authorOutput.textContent = trackTitle.slice(0, separatorIndex).trim();
    nameOutput.textContent = trackTitle.slice(separatorIndex + 1).trim();
  } else {
    nameOutput.textContent = trackTitle.trim();
  }
}

function displayResult(genre) {
  resultOutput.textContent = genre.toUpperCase();
}

runAnalysisButton.addEventListener('click', async () => {
  if (!audioFileInput.files.length) {
    alert("Выберите аудиофайл");
    return;
  }

  if (!model) {
    alert("модель не загружена. ожидайте загрузки");
    await modelLoad();
  }

  const chosenFile = audioFileInput.files[0];

  displayTrackInfo(chosenFile);

  waveformOutput.getContext('2d').clearRect(0, 0, waveformOutput.width, waveformOutput.height);

  resultOutput.textContent = `Обработка...`;
  loader.classList.remove('hidden');

  contentContainer.classList.add("show-result");

  const audioBuffer = await loadAudio(chosenFile);

  drawWaveplot(audioBuffer);

  const predictionsStream = streamPredictions(audioBuffer, model);

  for await (const message of predictionsStream) {
    switch (message.type) {
      case 'start':
        bubbleChart.updateStepSize(message.total);
        break;
      case 'segment':
        bubbleChart.addBubble(GENRES[message.genreIndex]);
        break;
      case 'final':
        displayResult(GENRES[message.genreIndex]);
        break;
    }
  }

  loader.classList.add('hidden');
});

backToInputButton.addEventListener('click', () => {
  contentContainer.classList.remove('show-result');
  bubbleChart.reset(); // лучше сбрасывать только тогда, когда страница уже уедет за экран
})

function updateWindowSize() {
    bubbleChart.resize();
}
window.onresize = updateWindowSize;