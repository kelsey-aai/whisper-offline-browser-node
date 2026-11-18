# Offline Whisper: browser + Node.js

Run OpenAI's Whisper speech recognition model with no API key and no audio leaving the machine:

- **Node.js** (`node/`): a CLI and a small HTTP server that transcribe WAV files on the CPU with [Transformers.js](https://huggingface.co/docs/transformers.js) and ONNX Runtime.
- **Browser** (`browser/`): a page that runs Whisper in a Web Worker on WebGPU, falling back to WebAssembly. Upload a file or record from the microphone.

Companion code for the AssemblyAI blog post [Offline speech recognition with Whisper: Browser + Node.js implementations](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js).

## Requirements

- Node.js 20 or later
- For WebGPU in the browser: a recent Chrome or Edge (other browsers use the WebAssembly fallback)
- About 80 MB of disk for the default `onnx-community/whisper-base` model

## 1. Clone and install

```bash
git clone https://github.com/kelsey-aai/whisper-offline-browser-node.git
cd whisper-offline-browser-node
npm install
```

## 2. Configure (optional)

No API key is needed. Two optional environment variables:

| Variable | Default | What it does |
|---|---|---|
| `WHISPER_MODEL` | `onnx-community/whisper-base` | Any Transformers.js Whisper model, e.g. `onnx-community/whisper-tiny.en`, `onnx-community/whisper-small`, `onnx-community/whisper-large-v3-turbo` |
| `HF_HUB_OFFLINE` | unset | Set to `1` after the first run to block all network access and load only from `./models` |

## 3. Run

### Node.js CLI

```bash
npm run transcribe -- samples/sample.wav
# non-English audio on a multilingual model:
npm run transcribe -- my-audio.wav spanish
```

The first run downloads the model to `./models`. After that it works offline:

```bash
HF_HUB_OFFLINE=1 npm run transcribe -- samples/sample.wav
```

The decoder in `node/wav.mjs` reads 16-bit PCM or 32-bit float WAV at any sample rate. Convert other formats first:

```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 input.wav
```

### Node.js HTTP server

```bash
npm run server
curl -X POST --data-binary @samples/sample.wav http://localhost:3000/api/transcribe
```

Add `?language=spanish` for non-English audio.

### Browser

```bash
npm run browser
```

Open http://localhost:8080, click **Load model**, then pick an audio file or click **Record**. The model is cached by the browser after the first load. Transformers.js and the ONNX Runtime WebAssembly files are served from `node_modules`, so no code comes from a CDN.

## Notes

- Transformers.js does not auto-detect the spoken language. Multilingual models default to English unless you pass a language. English-only `*.en` models reject a language option.
- `samples/sample.wav` is synthetic speech generated with macOS `say`.
- Model weights are not committed. They download from the Hugging Face Hub on first use.

## License

MIT
