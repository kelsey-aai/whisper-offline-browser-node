import { createServer } from "node:http";
import { decodeWav } from "./wav.mjs";
import { transcribe, getTranscriber, MODEL } from "./whisper.mjs";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BYTES = 100 * 1024 * 1024; // reject uploads over 100 MB

// Warm the model before accepting traffic so the first request isn't slow.
console.log(`Loading ${MODEL}...`);
await getTranscriber();

// Run one transcription at a time: the model is CPU-bound and shares one session.
let queue = Promise.resolve();
const enqueue = (job) => (queue = queue.then(job, job));

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method !== "POST" || url.pathname !== "/api/transcribe") {
    res.writeHead(404).end();
    return;
  }

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) throw Object.assign(new Error("File too large"), { status: 413 });
      chunks.push(chunk);
    }

    const samples = decodeWav(Buffer.concat(chunks));
    const language = url.searchParams.get("language");
    const result = await enqueue(() => transcribe(samples, { language }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ text: result.text.trim(), chunks: result.chunks }));
  } catch (err) {
    res.writeHead(err.status ?? 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}).listen(PORT, () => console.log(`Listening on http://localhost:${PORT}/api/transcribe`));
