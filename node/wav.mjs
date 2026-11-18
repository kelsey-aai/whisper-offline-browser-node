// Minimal WAV decoder: 16-bit PCM or 32-bit float, any sample rate, any channel count.
// Returns mono Float32Array samples at 16 kHz, which is what Whisper expects.

const TARGET_RATE = 16000;

export function decodeWav(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file. Convert it first: ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav");
  }

  let offset = 12;
  let format = null;
  let data = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = buffer.subarray(body, body + size);
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }

  if (!format || !data) throw new Error("WAV file is missing a fmt or data chunk.");

  const { audioFormat, channels, sampleRate, bitsPerSample } = format;
  const isPcm16 = audioFormat === 1 && bitsPerSample === 16;
  const isFloat32 = audioFormat === 3 && bitsPerSample === 32;
  if (!isPcm16 && !isFloat32) {
    throw new Error(`Unsupported WAV encoding (format ${audioFormat}, ${bitsPerSample}-bit). Use 16-bit PCM or 32-bit float.`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frames = Math.floor(data.length / (bytesPerSample * channels));
  const mono = new Float32Array(frames);

  // Average all channels into one.
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const pos = (i * channels + c) * bytesPerSample;
      sum += isPcm16 ? data.readInt16LE(pos) / 32768 : data.readFloatLE(pos);
    }
    mono[i] = sum / channels;
  }

  return resample(mono, sampleRate, TARGET_RATE);
}

// Linear-interpolation resampler. Good enough for speech; use ffmpeg for studio-grade conversion.
function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, samples.length - 1);
    const frac = pos - left;
    out[i] = samples[left] * (1 - frac) + samples[right] * frac;
  }
  return out;
}
