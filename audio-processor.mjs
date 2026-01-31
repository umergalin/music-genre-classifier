const CONFIG = {
  fs: 22500,
  n_mfcc: 13,
  n_fft: 2048,
  hop_length: 512,
  segment_duration: 3,
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

export async function* streamPredictions(audioBuffer, model) {
  try {
    const processedAudioData = await processAudio(audioBuffer);
    const segmentsMFCC = await extractForBuffer(processedAudioData);

    if (!segmentsMFCC || segmentsMFCC.length === 0) {
      console.log("сегменты не были получены");
      return;
    }

    yield { type: 'start', total: segmentsMFCC.length };

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

      predictions.push(maxIndex);

      yield { type: 'segment', genreIndex: maxIndex };

      // Освобождаем память тензора
      tensor.dispose();
      prediction.dispose();
    }

    // Подсчет самого частого жанра
    const counts = {};
    predictions.forEach(p => counts[p] = (counts[p] || 0) + 1);

    const sortedGenres = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const totalMaxIndex = sortedGenres[0];

    console.log("\n--- Результаты ---");
    console.log("Сегментов обработано:", segmentsMFCC.length);
    console.log("Предсказанные жанры по сегментам:", predictions.join(', '));
    console.log("Итоговый жанр:", totalMaxIndex);

    yield { type: 'final', genreIndex: totalMaxIndex };
  } catch (error) {
    console.error("Ошибка анализа:", error);
  }
}