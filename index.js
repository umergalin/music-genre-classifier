import { BubbleChart } from './bubble-chart.mjs';

console.log("hi");

const MODEL_PATH = '/model/model.json';

const CONFIG = {
  fs: 22500,
  n_mfcc: 13,
  n_fft: 2048,
  hop_length: 512,
  segment_duration: 3,
};

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
const runAnalysisButton = document.querySelector('.run-analysis');

const pageInput = document.getElementById('page-input');
const pageResult = document.getElementById('page-result');
const contentContainer = document.getElementById('content-container')
const returnButton = document.getElementById('return-button');
const waveformOutput = document.getElementById('waveform-output')

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

// ресемплинг AudioBuffer к targetRate
async function resampleAudioBuffer(audioBuffer, targetRate) {
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

async function extractForBuffer(monoSignal) {
  const samplesPerSegment = CONFIG.fs * CONFIG.segment_duration;
  const numSegments = Math.floor(monoSignal.length / samplesPerSegment);

  const totalUsedSamples = numSegments * samplesPerSegment;
  const leftoverSamples = monoSignal.length - totalUsedSamples;
  const startOffset = Math.floor(leftoverSamples / 2);

  const mfccsPerSegment = Math.ceil(samplesPerSegment / CONFIG.hop_length);
  const segmentsMFCC = [];

  for (let seg = 0; seg < numSegments; seg++) {
    console.log(`получение ${seg}-ого сегмента`);
    const startS = startOffset + seg * samplesPerSegment;
    const endS = startS + samplesPerSegment;

    const segment = monoSignal.subarray(startS, endS);

    const frames = [];
    for (let pos = 0; pos + CONFIG.n_fft <= segment.length; pos += CONFIG.hop_length) {
      const frame = segment.subarray(pos, pos + CONFIG.n_fft);

      const mfcc = Meyda.extract('mfcc', Array.from(frame), {
        bufferSize: CONFIG.n_fft,
        sampleRate: CONFIG.fs,
        hopSize: CONFIG.hop_length,
        melBands: 26,
        numberOfMFCCCoefficients: CONFIG.n_mfcc,
        windowingFunction: 'hann'
      });

      if (mfcc && mfcc.length === CONFIG.n_mfcc) frames.push(mfcc);
    }

    // padding frames до mfccsPerSegment (как в python)
    if (frames.length > 0) {
      while (frames.length < mfccsPerSegment) {
        frames.push(new Array(CONFIG.n_mfcc).fill(0));
      }
      segmentsMFCC.push(frames.slice(0, mfccsPerSegment));
    }
  }
  return segmentsMFCC;
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

async function processAudio(audioBuffer) {
  try {
    // ресэмплим к fs если надо
    if (Math.round(audioBuffer.sampleRate) !== Math.round(CONFIG.fs)) {
      console.log(`Ресемплирование от  ${audioBuffer.sampleRate} к ${CONFIG.fs} Hz`);
      audioBuffer = await resampleAudioBuffer(audioBuffer, CONFIG.fs);
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

async function runAnalysis(file) {
  contentContainer.classList.add("show-result");

  try {
    if (!model) {
      console.log("модель не загружена. ожидайте загрузки");
      await modelLoad();
    }

    console.log(`Обработка аудио: ${file.name}`);

    const audioBuffer = await loadAudio(file);

    drawWaveplot(audioBuffer);

    const processedAudioBuffer = await processAudio(audioBuffer);
    const segmentsMFCC = await extractForBuffer(processedAudioBuffer);

    if (!segmentsMFCC || segmentsMFCC.length === 0) {
      console.log("сегменты не были получены");
      return;
    }

    bubbleChart.updateStepSize(segmentsMFCC.length);

    const predictions = [];

    for (const mfccMatrix of segmentsMFCC) {

      // i eat cement
      // Преобразуем в тензор
      // Форма в Python: (1, n_mfcc, time, 1) - т.к. вы делали np.newaxis
      // Проверьте inputShape вашей модели через model.summary() в JS или Python.
      // Обычно CNN требует (batch, height, width, channels)

      // Формируем тензор: [1, n_mfcc, time_steps, 1]
      const tensor = tf.tensor(mfccMatrix)
        .expandDims(0) // Batch dim
        .expandDims(-1); // Channel dim

      // Предсказание
      const prediction = model.predict(tensor);
      const data = await prediction.data(); // Получаем вероятности
      const maxIndex = data.indexOf(Math.max(...data));

      predictions.push(GENRES[maxIndex]);
      bubbleChart.addBubble(GENRES[maxIndex]);

      // Освобождаем память тензора
      tensor.dispose();
      prediction.dispose();
    }

    // Подсчет самого частого жанра
    const counts = {};
    predictions.forEach(p => counts[p] = (counts[p] || 0) + 1);

    const sortedGenres = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const finalGenre = sortedGenres[0];

    console.log("\n--- Результаты ---");
    console.log("Сегментов обработано:", segmentsMFCC.length);
    console.log("Предсказанные жанры по сегментам:", predictions.join(', '));
    console.log("Итоговый жанр:", finalGenre);

    displayResult(finalGenre);

    return finalGenre;
  } catch (error) {
    console.error("Ошибка анализа:", error);
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

  const chosenFile = audioFileInput.files[0];

  displayTrackInfo(chosenFile);

  waveformOutput.getContext('2d').clearRect(0, 0, waveformOutput.width, waveformOutput.height);

  resultOutput.textContent = `Обработка...`;
  loader.classList.remove('hidden');

  await runAnalysis(chosenFile);

  loader.classList.add('hidden');
});

returnButton.addEventListener('click', () => {
  contentContainer.classList.remove('show-result');
  bubbleChart.reset(); // лучше сбрасывать только тогда, когда страница уже уедет за экран
})

function updateWindowSize() {
    bubbleChart.resize();
}
window.onresize = updateWindowSize;