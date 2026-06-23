/**
 * Compress silence out of captured PCM16 audio so only the candidate's speech
 * (plus short, natural pauses) is sent for evaluation. This keeps the payload
 * small and the evaluation fast, instead of shipping minutes of dead air while
 * the examiner speaks or the candidate thinks.
 *
 * A frame is "voiced" if its peak amplitude reaches `thresholdPeak`. Leading and
 * trailing silence is dropped; internal silence runs are truncated to
 * `maxSilenceMs` so speech rhythm is preserved without the long gaps.
 */
export function compressSilence(
  samples: Int16Array,
  sampleRate: number,
  opts: { thresholdPeak?: number; frameMs?: number; maxSilenceMs?: number } = {},
): Int16Array {
  const thresholdPeak = opts.thresholdPeak ?? 600;
  const frameMs = opts.frameMs ?? 20;
  const maxSilenceMs = opts.maxSilenceMs ?? 300;

  const frameLen = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const maxSilenceFrames = Math.floor(maxSilenceMs / frameMs);

  type Frame = { start: number; end: number; voiced: boolean };
  const frames: Frame[] = [];
  for (let i = 0; i < samples.length; i += frameLen) {
    const end = Math.min(i + frameLen, samples.length);
    let peak = 0;
    for (let j = i; j < end; j++) {
      const a = Math.abs(samples[j]);
      if (a > peak) peak = a;
    }
    frames.push({ start: i, end, voiced: peak >= thresholdPeak });
  }

  const firstVoiced = frames.findIndex((f) => f.voiced);
  if (firstVoiced === -1) return new Int16Array(0);
  let lastVoiced = frames.length - 1;
  while (lastVoiced > firstVoiced && !frames[lastVoiced].voiced) lastVoiced--;

  const kept: Frame[] = [];
  let silenceRun = 0;
  for (let k = firstVoiced; k <= lastVoiced; k++) {
    const frame = frames[k];
    if (frame.voiced) {
      kept.push(frame);
      silenceRun = 0;
    } else {
      silenceRun++;
      if (silenceRun <= maxSilenceFrames) kept.push(frame);
    }
  }

  const total = kept.reduce((sum, f) => sum + (f.end - f.start), 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const f of kept) {
    out.set(samples.subarray(f.start, f.end), offset);
    offset += f.end - f.start;
  }
  return out;
}

/**
 * Prepare captured audio for evaluation: trim dead air, fall back to the raw
 * audio if trimming removed almost everything (quiet mic), then cap to
 * `maxSeconds` so the payload and evaluation latency stay bounded. A capped
 * sample of speech is ample for assessing pronunciation and fluency.
 */
export function prepareEvalAudio(
  samples: Int16Array,
  sampleRate: number,
  opts: { maxSeconds?: number; thresholdPeak?: number; frameMs?: number; maxSilenceMs?: number } = {},
): Int16Array {
  const maxSeconds = opts.maxSeconds ?? 90;
  const compressed = compressSilence(samples, sampleRate, opts);
  const audio = compressed.length >= sampleRate / 2 ? compressed : samples;
  const maxLen = maxSeconds * sampleRate;
  return audio.length > maxLen ? audio.subarray(0, maxLen) : audio;
}
