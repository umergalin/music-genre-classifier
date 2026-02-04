import * as tf from 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/+esm';
import Meyda from 'https://esm.sh/meyda';

export const CONFIG = {
  fs: 22500,
  n_mfcc: 13,
  n_fft: 2048,
  hop_length: 512,
  segment_duration: 3,
  melBands: 26,
  windowingFunction: 'hann'
};

function extractMFCCfromSegment(segment, mfccsPerSegment) {
  const frames = [];
  for (let pos = 0; pos + CONFIG.n_fft <= segment.length; pos += CONFIG.hop_length) {
    const frame = segment.subarray(pos, pos + CONFIG.n_fft);

    const mfcc = Meyda.extract('mfcc', frame, {
      bufferSize: CONFIG.n_fft,
      sampleRate: CONFIG.fs,
      hopSize: CONFIG.hop_length,
      melBands: CONFIG.melBands,
      numberOfMFCCCoefficients: CONFIG.n_mfcc,
      windowingFunction: CONFIG.windowingFunction
    });

    if (mfcc && mfcc.length === CONFIG.n_mfcc) frames.push(mfcc);
  }

  if (frames.length === 0) return null;

  // дополнение до mfccsPerSegment
  while (frames.length < mfccsPerSegment) {
    frames.push(new Array(CONFIG.n_mfcc).fill(0));
  }

  return frames.slice(0, mfccsPerSegment);
}

export async function* streamPredictions(audioData, model) {
  try {
    const samplesPerSegment = CONFIG.fs * CONFIG.segment_duration;
    const numSegments = Math.floor(audioData.length / samplesPerSegment);

    yield { type: 'start', total: numSegments };

    // рассчитываем отступ для размещения окна анализа по середине
    const totalUsedSamples = numSegments * samplesPerSegment;
    const leftoverSamples = audioData.length - totalUsedSamples;
    const startOffset = Math.floor(leftoverSamples / 2);

    const mfccsPerSegment = Math.ceil(samplesPerSegment / CONFIG.hop_length);
    const predictions = [];

    for (let i = 0; i < numSegments; i++) {
      console.log(`получение ${i}-ого сегмента`);
      const segmentStart = startOffset + i * samplesPerSegment;
      const segmentEnd = segmentStart + samplesPerSegment;

      const segment = audioData.subarray(segmentStart, segmentEnd);

      const mfcc = extractMFCCfromSegment(segment, mfccsPerSegment);
      if (!mfcc) continue;

      // i eat cement
      const tensor = tf.tensor(mfcc).expandDims(0).expandDims(-1);

      const prediction = model.predict(tensor);
      const data = await prediction.data();
      const maxIndex = data.indexOf(Math.max(...data));

      tensor.dispose();
      prediction.dispose();

      predictions.push(maxIndex);
      yield { type: 'segment', genreIndex: maxIndex };
    }

    // Подсчет самого частого жанра
    const counts = {};
    predictions.forEach(p => counts[p] = (counts[p] || 0) + 1);

    const sortedGenres = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const totalMaxIndex = sortedGenres[0];

    console.log("\n--- Результаты ---");
    console.log("Сегментов обработано:", numSegments);
    console.log("Предсказанные жанры по сегментам:", predictions.join(', '));
    console.log("Итоговый жанр:", Number(totalMaxIndex));

    yield { type: 'final', genreIndex: totalMaxIndex };
  } catch (error) {
    console.error("Ошибка в генераторе:", error);
  }
}