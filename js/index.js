import { loadAudio, preprocessAudio } from "./audio-processor.mjs";
import { BubbleChart } from "./bubble-chart.mjs";
import { WavePlotter } from "./wave-plotter.mjs";
import { parseTrackTitle, getCSSVar } from "./utils.js";
import { PATHS, GENRES, UI_DEFAULTS } from "./config.js";

console.log("hi");

const waveformContainer = document.querySelector(".js-waveform-container");
const wavePlotter = new WavePlotter(waveformContainer);

const bubbleChartContainer = document.querySelector(".bubble-chart");
const bubbleChart = new BubbleChart(bubbleChartContainer, GENRES);

const audioFileInput = document.getElementById("audio-file-input");
const audioFileDragArea = document.querySelector(".file-upload__drag-area");
const runAnalysisButton = document.querySelector(".js-run-analysis");
const uploadedFilenameOutput = document.querySelector(".js-input-file-name");
const removeUploadedFileButton = document.querySelector(".js-remove-file");

const pageInput = document.querySelector(".page-input");
const pageResult = document.querySelector(".page-result");

const contentContainer = document.getElementById("content-container");
const backToInputButton = document.querySelector(".js-back-trigger");

const nameOutput = document.querySelector(".metadata .name");
const authorOutput = document.querySelector(".metadata .author");

const resultOutput = document.querySelector(".result .genre");
const loader = document.querySelector(".loader");

function displayTrackInfo(file) {
  const track = parseTrackTitle(file.name);
  if (!track.author) authorOutput.textContent = track.author;
  nameOutput.textContent = track.title;
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

function validateFileType(file) {
  if (!file.type.startsWith("audio/")) {
    throw new Error("Пожалуйста, выберите аудиофайл");
  }
}

function validateAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;

    audio.onloadedmetadata = function () {
      URL.revokeObjectURL(objectUrl);
      if (audio.duration < 3) {
        reject(new Error("Файл слишком короткий (минимум 3 секунды)"));
      } else {
        resolve();
      }
    };

    audio.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Не удалось прочитать аудиофайл"));
    };
  });
}

function handleCancelUpload() {
  resetInputState();
}

function resetInputState() {
  audioFileInput.value = "";
  runAnalysisButton.disabled = true; 
  toggleInputHasFileStyle(false);
}

function toggleInputHasFileStyle(hasFile) {
  audioFileDragArea.classList.toggle("has-file", hasFile);
}

async function handleFileInputChange() {
  const file = audioFileInput.files[0];

  if (!file) {
    runAnalysisButton.disabled = true;
    return;
  }

  try {
    validateFileType(file);
    await validateAudioDuration(file);

    console.log("Validation succeed");
    runAnalysisButton.disabled = false;
    uploadedFilenameOutput.textContent = file.name;
    toggleInputHasFileStyle(true);
  } catch (error) {
    console.error("Validation failed");
    resetInputState();
  }
}

function handleBackToInput() {
  contentContainer.classList.remove("show-result");
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

function handleDrop(e) {
  e.preventDefault();
  toggleDraggingStyle(false);

  audioFileInput.files = e.dataTransfer.files;
  audioFileInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function toggleDraggingStyle(isDragging) {
  audioFileDragArea.classList.toggle("is-dragging", isDragging);
}

function setupEventListeners(worker) {
  audioFileInput.addEventListener("change", handleFileInputChange);
  audioFileDragArea.addEventListener("dragenter", (e) => {
    e.preventDefault();
    toggleDraggingStyle(true);
  });

  audioFileDragArea.addEventListener("dragover", (e) => e.preventDefault());
  audioFileDragArea.addEventListener("dragleave", (e) => {
    if (!audioFileDragArea.contains(e.relatedTarget)) toggleDraggingStyle(false);; 
    // toggleDraggingStyle(false);
  });
  audioFileDragArea.addEventListener("drop", (e) => handleDrop(e));
  removeUploadedFileButton.addEventListener("click", resetInputState)
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