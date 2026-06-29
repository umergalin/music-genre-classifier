import * as tf from 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/+esm';
import { extractMFCCfromSegment, CONFIG } from './audio-processor.mjs';

export async function* streamPredictions(audioData, model) {
  try {
    const samplesPerSegment = CONFIG.fs * CONFIG.segment_duration;
    const segmentCount = Math.floor(audioData.length / samplesPerSegment);

    yield { type: 'start', segmentCount: segmentCount };

    // рассчитываем отступ для размещения окна анализа по середине
    const totalUsedSamples = segmentCount * samplesPerSegment;
    const leftoverSamples = audioData.length - totalUsedSamples;
    const startOffset = Math.floor(leftoverSamples / 2);

    const mfccsPerSegment = Math.ceil(samplesPerSegment / CONFIG.hop_length);
    const predictions = [];

    for (let i = 0; i < segmentCount; i++) {
      const segmentStart = startOffset + i * samplesPerSegment;
      const segment = audioData.subarray(segmentStart, segmentStart + samplesPerSegment);

      const mfcc = extractMFCCfromSegment(segment, mfccsPerSegment);
      if (!mfcc) continue;

      // i eat cement
      const tensor = tf.tidy(() => tf.tensor(mfcc).expandDims(0).expandDims(-1));
      const prediction = model.predict(tensor);
      const data = await prediction.data();
      const maxIndex = data.indexOf(Math.max(...data));

      tensor.dispose();
      prediction.dispose();

      predictions.push(maxIndex);
      yield { type: 'segment', genreIndex: maxIndex, segmentIndex: i };
    }

    // Подсчет самого частого жанра
    const counts = {};
    predictions.forEach(p => counts[p] = (counts[p] || 0) + 1);

    const totalMaxIndex = Number(Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]);

    yield { type: 'final', genreIndex: totalMaxIndex };
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
}