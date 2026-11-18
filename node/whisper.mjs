import { pipeline, env } from "@huggingface/transformers";

// Model weights download from the Hugging Face Hub on first run and are cached in ./models.
// After that, set HF_HUB_OFFLINE=1 to guarantee no network access.
env.cacheDir = "./models";
if (process.env.HF_HUB_OFFLINE === "1") env.allowRemoteModels = false;

const MODEL = process.env.WHISPER_MODEL ?? "onnx-community/whisper-base";

let transcriberPromise = null;

// Load the pipeline once and reuse it for every request.
export function getTranscriber() {
  transcriberPromise ??= pipeline("automatic-speech-recognition", MODEL, {
    device: "cpu", // onnxruntime-node; use "cuda" on Linux x64 with a CUDA build
    dtype: "q8", // 8-bit quantized weights: smaller download, faster on CPU
  });
  return transcriberPromise;
}

export async function transcribe(samples, { language = null } = {}) {
  const transcriber = await getTranscriber();
  return transcriber(samples, {
    chunk_length_s: 30, // Whisper's native window; longer audio is split into 30 s chunks
    stride_length_s: 5, // overlap between chunks so words at the edges aren't dropped
    return_timestamps: true,
    // Transformers.js does not auto-detect language: multilingual models default to English.
    // Pass a language (e.g. "spanish" or "es") for other audio. Don't set it on English-only *.en models.
    ...(language ? { language, task: "transcribe" } : {}),
  });
}

export { MODEL };
