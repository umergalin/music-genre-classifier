import { preprocessAudio } from './audio-processor.mjs'
import { BubbleChart } from './bubble-chart.mjs';
import { WavePlotter } from './wave-plotter.mjs';
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

const worker = new Worker('audio-analyzer-worker.js', { type: 'module' });
worker.postMessage({ type: 'loadModel', modelPath: MODEL_PATH });

worker.onerror = function(event) {
  console.error("Ошибка в воркере:");
  console.error(`Сообщение: ${event.message}`);
  console.error(`Файл: ${event.filename}, Строка: ${event.lineno}`);
};

const waveformContainer = document.querySelector('.js-waveform-container')
const wavePlotter = new WavePlotter(waveformContainer);

const getCSSVar = (varName) => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
};

worker.onmessage = function (e) { // Слушаем сообщения из воркера
  const message = e.data;
  switch (message.type) {
    case 'start':
      bubbleChart.updateStepSize(message.segmentCount);
      wavePlotter.setSegmentsCount(message.segmentCount);
      break;
    case 'segment':
      const genre = GENRES[message.genreIndex];
      wavePlotter.setSegmentColor(message.segmentIndex, getCSSVar(`--${genre}-bg`));
      bubbleChart.addBubble(genre);  
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

runAnalysisButton.addEventListener('click', async () => {
  if (!audioFileInput.files.length) {
    alert("Выберите аудиофайл");
    return;
  }

  const chosenFile = audioFileInput.files[0];

  displayTrackInfo(chosenFile);

  resultOutput.textContent = `Обработка...`;
  loader.classList.remove('hidden');

  contentContainer.classList.add("show-result");

  const audioBuffer = await loadAudio(chosenFile);

  wavePlotter.render(audioBuffer);

  const processedAudioData = await preprocessAudio(audioBuffer);

  worker.postMessage({
    type: 'runAnalysis',
    audioData: processedAudioData
  }, [processedAudioData.buffer]);
});

backToInputButton.addEventListener('click', () => {
  contentContainer.classList.remove('show-result');
  clearResults();
})

function clearResults() { // лучше сбрасывать только тогда, когда страница уже уедет за экран
  wavePlotter.reset();
  bubbleChart.reset(); 
}

function updateWindowSize() {
  bubbleChart.resize();
}
window.onresize = updateWindowSize;