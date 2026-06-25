import * as tf from 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/+esm';
import { streamPredictions } from './audio-analyzer.mjs';

let modelPromise = null;

function loadModel(modelPath) {
  console.log('загружаю модель');
  modelPromise = tf.loadLayersModel(modelPath);
}

async function runAnalysis(audioData) {
  console.log('запускаю анализ');

  const model = await modelPromise;

  if (!model) {
    console.log('модель не инициализирована')
    self.postMessage({ type: 'error', message: 'Модель не инициализирована' });
    return;
  }

  console.log('модель готова к использованию');

  const predictionsStream = streamPredictions(audioData, model);

  for await (const message of predictionsStream) {
    self.postMessage(message);
  }
}

onmessage = function (e) { // Слушаем сообщения из основного потока
  const { type, modelPath, audioData } = e.data;

  switch (type) {
    case 'loadModel':
      loadModel(modelPath);
      break;
    case 'runAnalysis':
      runAnalysis(audioData)
      break;
  }
}