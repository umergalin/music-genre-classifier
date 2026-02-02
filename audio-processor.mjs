const CONFIG = {
  fs: 22500,
  n_mfcc: 13,
  n_fft: 2048,
  hop_length: 512,
  segment_duration: 3,
  melBands: 26,
  windowingFunction: 'hann'
};

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

export async function* streamPredictions(audioBuffer, model) {
  try {
    const processedAudioData = await preprocessAudio(audioBuffer);

    const samplesPerSegment = CONFIG.fs * CONFIG.segment_duration;
    const numSegments = Math.floor(processedAudioData.length / samplesPerSegment);

    yield { type: 'start', total: numSegments };

    // рассчитываем отступ для размещения окна анализа по середине
    const totalUsedSamples = numSegments * samplesPerSegment;
    const leftoverSamples = processedAudioData.length - totalUsedSamples;
    const startOffset = Math.floor(leftoverSamples / 2);

    const mfccsPerSegment = Math.ceil(samplesPerSegment / CONFIG.hop_length);
    const predictions = [];

    for (let i = 0; i < numSegments; i++) {
      console.log(`получение ${i}-ого сегмента`);
      const segmentStart = startOffset + i * samplesPerSegment;
      const segmentEnd = segmentStart + samplesPerSegment;

      const segment = processedAudioData.subarray(segmentStart, segmentEnd);

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
    console.error("Ошибка анализа:", error);
  }
}