// Runs Whisper in a Web Worker so model loading and inference never block the page.
// The library is served from this app's own origin (see serve.mjs), not a CDN.
import { pipeline, env } from "/vendor/transformers.min.js";

// Transformers.js fetches the ONNX Runtime WebAssembly files from a CDN by default.
// Serve them locally instead so the app keeps working with no network.
env.backends.onnx.wasm.wasmPaths = {
  mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs",
  wasm: "/ort/ort-wasm-simd-threaded.asyncify.wasm",
};

const MODEL = "onnx-community/whisper-base";
let transcriber = null;

async function load() {
  if (transcriber) return transcriber;
  const device = (await hasWebGPU()) ? "webgpu" : "wasm";
  self.postMessage({ type: "device", device });

  transcriber = await pipeline("automatic-speech-recognition", MODEL, {
    device,
    // fp32 encoder + q4 decoder is a good balance on WebGPU; q8 is safest on WASM.
    dtype: device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
    progress_callback: (p) => self.postMessage({ type: "progress", ...p }),
  });
  return transcriber;
}

async function hasWebGPU() {
  if (!navigator.gpu) return false;
  try {
    return Boolean(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      await load();
      self.postMessage({ type: "ready" });
    } else if (data.type === "transcribe") {
      const asr = await load();
      const started = performance.now();
      const result = await asr(data.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
      self.postMessage({ type: "result", result, ms: Math.round(performance.now() - started) });
    }
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
};
