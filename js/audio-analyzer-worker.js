import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/+esm";
import { streamPredictions } from "./audio-analyzer.mjs";

let modelPromise = null;
let aborted = false;

function loadModel(modelPath) {
  modelPromise = tf.loadLayersModel(modelPath);
}

async function runAnalysis(audioData) {
  const model = await modelPromise;
  const predictionsStream = streamPredictions(audioData, model);

  aborted = false;
  for await (const message of predictionsStream) {
    if (aborted) break;
    self.postMessage(message);
  }
}

onmessage = function (e) {
  const { type, modelPath, audioData } = e.data;

  switch (type) {
    case "loadModel":
      loadModel(modelPath);
      break;
    case "runAnalysis":
      runAnalysis(audioData);
      break;
    case "abort":
      aborted = true;
      break;
  }
};