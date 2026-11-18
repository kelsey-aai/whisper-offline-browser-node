const worker = new Worker("/worker.js", { type: "module" });

const $ = (id) => document.getElementById(id);
const status = (text) => ($("status").textContent = text);

let recorder = null;
let recordedChunks = [];

worker.onmessage = ({ data }) => {
  switch (data.type) {
    case "device":
      $("device").textContent = data.device === "webgpu" ? "WebGPU" : "WebAssembly (CPU)";
      break;
    case "progress":
      if (data.status === "progress") status(`Downloading ${data.file}: ${Math.round(data.progress)}%`);
      break;
    case "ready":
      status("Model ready. Pick a file or record.");
      $("file").disabled = false;
      $("record").disabled = false;
      break;
    case "result":
      status(`Done in ${(data.ms / 1000).toFixed(1)} s`);
      $("output").textContent = data.result.text.trim();
      break;
    case "error":
      status(`Error: ${data.message}`);
      break;
  }
};

$("load").onclick = () => {
  $("load").disabled = true;
  status("Loading model...");
  worker.postMessage({ type: "load" });
};

$("file").onchange = async (event) => {
  const file = event.target.files[0];
  if (file) await transcribeBlob(file);
};

$("record").onclick = async () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder = new MediaRecorder(stream);
  recordedChunks = [];
  recorder.ondataavailable = (e) => recordedChunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    $("record").textContent = "Record";
    await transcribeBlob(new Blob(recordedChunks, { type: recorder.mimeType }));
  };
  recorder.start();
  $("record").textContent = "Stop";
  status("Recording...");
};

// Decode any format the browser supports (MP3, WAV, WebM, M4A...) into 16 kHz mono PCM.
// An AudioContext created at 16 kHz resamples for us during decodeAudioData.
async function transcribeBlob(blob) {
  status("Decoding audio...");
  const ctx = new AudioContext({ sampleRate: 16000 });
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();

  const audio = downmix(decoded);
  status(`Transcribing ${(audio.length / 16000).toFixed(1)} s of audio...`);
  worker.postMessage({ type: "transcribe", audio }, [audio.buffer]);
}

function downmix(buffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += channel[i] / buffer.numberOfChannels;
  }
  return out;
}
