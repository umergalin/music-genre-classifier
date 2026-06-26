import { loadAudio, preprocessAudio } from "./audio-processor.mjs";
import { BubbleChart } from "./bubble-chart.mjs";
import { WavePlotter } from "./wave-plotter.mjs";
import { getCSSVar } from "./utils.js";
import { PATHS, GENRES, UI_DEFAULTS } from "./config.js";

console.log("hi");

const waveformContainer = document.querySelector(".js-waveform-container");
const wavePlotter = new WavePlotter(waveformContainer);

const bubbleChartContainer = document.querySelector(".bubble-chart");
const bubbleChart = new BubbleChart(bubbleChartContainer, GENRES);

const audioFileInput = document.getElementById("audio-file-input");
const runAnalysisButton = document.querySelector(".js-run-analysis");

const pageInput = document.querySelector(".page-input");
const pageResult = document.querySelector(".page-result");

const contentContainer = document.getElementById("content-container");
const backToInputButton = document.querySelector(".js-back-trigger");

const nameOutput = document.querySelector(".metadata .name");
const authorOutput = document.querySelector(".metadata .author");

const resultOutput = document.querySelector(".result .genre");
const loader = document.querySelector(".loader");

function displayTrackInfo(file) {
  const fileName = file.name;

  const lastDotIndex = fileName.lastIndexOf(".");
  const trackTitle =
    lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;

  const separatorIndex = trackTitle.indexOf("-");

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

function clearResults() {
  // лучше сбрасывать только тогда, когда страница уже уедет за экран
  authorOutput.textContent = "";
  nameOutput.textContent = "";
  resultOutput.textContent = "";

  wavePlotter.reset();
  bubbleChart.reset();
}

function prepareForProcessing() {
  authorOutput.textContent = UI_DEFAULTS.AUTHOR;
  nameOutput.textContent = UI_DEFAULTS.NAME;
  resultOutput.textContent = UI_DEFAULTS.STATUS;

  loader.classList.remove("hidden");
}

function setupWorker({ onStart, onSegment, onFinal }) {
  const worker = new Worker(PATHS.worker, { type: "module" });
  worker.postMessage({ type: "loadModel", modelPath: PATHS.model });

  worker.onerror = function (event) {
    console.error("Ошибка в воркере:");
    console.error(`Сообщение: ${event.message}`);
    console.error(`Файл: ${event.filename}, Строка: ${event.lineno}`);
  };

  worker.onmessage = function ({ data }) {
    switch (data.type) {
      case "start":
        onStart(data);
        break;
      case "segment":
        onSegment(data);
        break;
      case "final":
        onFinal(data);
        break;
    }
  };

  return worker;
}

function validateAudioDuration(file, { onValid, onInvalid }) {
  const audio = new Audio();
  const objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;

  audio.onloadedmetadata = function () {
    URL.revokeObjectURL(objectUrl);

    if (audio.duration < 3) {
      console.log("Файл слишком короткий (минимум 3 секунды)");
      onInvalid();
    } else {
      onValid();
    }
  };
}

function handleFileInputChange() {
  const file = audioFileInput.files[0];

  if (!file) {
    runAnalysisButton.disabled = true;
    return;
  }

  validateAudioDuration(file, {
    onValid: () => (runAnalysisButton.disabled = false),
    onInvalid: () => {
      audioFileInput.value = "";
      runAnalysisButton.disabled = true;
    },
  });
}

function handleBackToInput() {
  contentContainer.classList.remove("show-result");
  audioFileInput.value = "";
  runAnalysisButton.disabled = true;
  clearResults();
}

async function handleRunAnalysis(worker) {
  const file = audioFileInput.files[0];
  await startAnalysis(file, worker);
}

async function startAnalysis(file, worker) {
  clearResults();
  prepareForProcessing();

  displayTrackInfo(file);
  contentContainer.classList.add("show-result");

  const audioBuffer = await loadAudio(file);
  wavePlotter.render(audioBuffer);
  const processedAudioData = await preprocessAudio(audioBuffer);

  worker.postMessage(
    {
      type: "runAnalysis",
      audioData: processedAudioData,
    },
    [processedAudioData.buffer],
  );
}

function setupEventListeners(worker) {
  audioFileInput.addEventListener("change", handleFileInputChange);
  backToInputButton.addEventListener("click", handleBackToInput);
  runAnalysisButton.addEventListener("click", () => handleRunAnalysis(worker));
  window.addEventListener("resize", () => bubbleChart.resize());
}

function init() {
  const worker = setupWorker({
    onStart: ({ segmentCount }) => {
      bubbleChart.updateStepSize(segmentCount);
      wavePlotter.setSegmentsCount(segmentCount);
    },
    onSegment: ({ genreIndex, segmentIndex }) => {
      const genre = GENRES[genreIndex];
      wavePlotter.setSegmentColor(segmentIndex, getCSSVar(`--${genre.id}-bg`));
      bubbleChart.addBubble(genreIndex);
    },
    onFinal: ({ genreIndex }) => {
      displayResult(GENRES[genreIndex].id);
      loader.classList.add("hidden");
    },
  });

  setupEventListeners(worker);
}

init();