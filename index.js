import { BubbleChart } from './bubble-chart.mjs';
import { CONFIG } from './audio-processor.mjs';
import { WavePlotter } from './wave-plotter.mjs'
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

const worker = new Worker('audio-processor-worker.js', { type: 'module' });
worker.postMessage({ type: 'loadModel', modelPath: MODEL_PATH });

const waveformContainer = document.querySelector('.js-waveform-container')
const waveplotter = new WavePlotter(waveformContainer);

worker.onmessage = function (e) { // Слушаем сообщения из воркера
  const message = e.data;
  switch (message.type) {
    case 'start':
      bubbleChart.updateStepSize(message.total);
      break;
    case 'segment':
      bubbleChart.addBubble(GENRES[message.genreIndex]);
      break;
    case 'final':
      displayResult(GENRES[message.genreIndex]);
      loader.classList.add('hidden');
      break;
  }
}

const bubbleChartContainer = document.querySelector('.bubble-chart');
const bubbleChart = new BubbleChart(bubbleChartContainer, GENRES_TRANSLATION, GENRES_EMOJIS);

const audioFileInput = document.getElementById('audio-file-input');
const runAnalysisButton = document.querySelector('.js-run-analysis');

const pageInput = document.querySelector('.page-input');
const pageResult = document.querySelector('.page-result');

const contentContainer = document.getElementById('content-container')
const backToInputButton = document.querySelector('.js-back-trigger');


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

function toMono(audioBuffer) {
  const channelNum = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;

  if (channelNum === 1) return audioBuffer.getChannelData(0).slice(0);

  const out = new Float32Array(len);
  for (let ch = 0; ch < channelNum; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i] / channelNum;
  }
  return out;
}

async function resample(audioBuffer, targetRate) {
  if (audioBuffer.sampleRate === targetRate) return audioBuffer;
  const numChannels = audioBuffer.numberOfChannels;
  const duration = audioBuffer.duration;
  const offlineCtx = new OfflineAudioContext(numChannels, Math.ceil(duration * targetRate), targetRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(offlineCtx.destination);
  src.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered;
}

async function preprocessAudio(audioBuffer) {
  try {
    // ресэмплим к fs если надо
    if (Math.round(audioBuffer.sampleRate) !== Math.round(CONFIG.fs)) {
      console.log(`Ресемплирование от  ${audioBuffer.sampleRate} к ${CONFIG.fs} Hz`);
      audioBuffer = await resample(audioBuffer, CONFIG.fs);
      console.log(`Файл ресемплирован`);
    }

    // моно и padding/trim до samplesPerTrack
    let mono = toMono(audioBuffer);
    /* if (mono.length < samplesPerTrack) {
        const padded = new Float32Array(samplesPerTrack);
        padded.set(mono, 0);
        mono = padded;
    } else if (mono.length > samplesPerTrack) {
        mono = mono.subarray(0, samplesPerTrack);
    } else {
        log("Паддинг не требуется");
    } */

    return mono;
  } catch (err) {
    console.warn('Ошибка при обработке файла', err);
    throw (err);
  }
}

runAnalysisButton.addEventListener('click', async () => {
  if (!audioFileInput.files.length) {
    alert("Выберите аудиофайл");
    return;
  }

  // if (!model) {
  //   alert("модель не загружена. ожидайте загрузки");
  //   await modelLoad();
  // }

  const chosenFile = audioFileInput.files[0];

  displayTrackInfo(chosenFile);

  waveplotter.clear();

  resultOutput.textContent = `Обработка...`;
  loader.classList.remove('hidden');

  contentContainer.classList.add("show-result");

  const audioBuffer = await loadAudio(chosenFile);

  waveplotter.drawPlaceholder(audioBuffer);

  const processedAudioData = await preprocessAudio(audioBuffer);

  worker.postMessage({
    type: 'runAnalysis',
    audioData: processedAudioData
  }, [processedAudioData.buffer]);

  
});

backToInputButton.addEventListener('click', () => {
  contentContainer.classList.remove('show-result');
  bubbleChart.reset(); // лучше сбрасывать только тогда, когда страница уже уедет за экран
})

function updateWindowSize() {
    bubbleChart.resize();
}
window.onresize = updateWindowSize;