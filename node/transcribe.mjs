import { readFile } from "node:fs/promises";
import { decodeWav } from "./wav.mjs";
import { getTranscriber, transcribe, MODEL } from "./whisper.mjs";

const file = process.argv[2];
const language = process.argv[3] ?? null;

if (!file) {
  console.error("Usage: node node/transcribe.mjs <file.wav> [language]");
  process.exit(1);
}

const samples = decodeWav(await readFile(file));
console.log(`Model: ${MODEL}`);
console.log(`Audio: ${(samples.length / 16000).toFixed(1)} s`);

let started = performance.now();
await getTranscriber(); // downloads the model on the first run, then loads it from ./models
console.log(`Model loaded in ${((performance.now() - started) / 1000).toFixed(1)} s`);

started = performance.now();
const result = await transcribe(samples, { language });
const seconds = ((performance.now() - started) / 1000).toFixed(1);

console.log(`\nTranscript (${seconds} s):\n${result.text.trim()}\n`);
for (const { timestamp, text } of result.chunks ?? []) {
  const [start, end] = timestamp;
  console.log(`[${start.toFixed(2)} → ${end?.toFixed(2) ?? "?"}] ${text.trim()}`);
}
