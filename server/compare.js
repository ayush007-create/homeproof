// Sends the same room photos to every configured Gemini model and compares them.
// Run with: npm run compare -- <folder of .jpg files>
import "./env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { MODEL, FALLBACK_MODELS, scanFramesWithModel } from "./gemini.js";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: npm run compare -- <folder with .jpg photos of one room>");
  process.exit(1);
}

const files = (await fs.readdir(folder)).filter((f) => /\.jpe?g$/i.test(f)).sort().slice(0, 30);
if (!files.length) {
  console.error(`No .jpg files found in ${folder}`);
  process.exit(1);
}
const frames = await Promise.all(
  files.map(async (f, i) => ({ data: await fs.readFile(path.join(folder, f)), mimeType: "image/jpeg", time: i * 2 }))
);
console.log(`Sending ${frames.length} photos to ${[MODEL, ...FALLBACK_MODELS].join(", ")}…\n`);

const results = [];
for (const model of [MODEL, ...FALLBACK_MODELS]) {
  const started = Date.now();
  try {
    const items = await scanFramesWithModel(model, frames);
    results.push({ model, ms: Date.now() - started, items });
  } catch (err) {
    results.push({ model, ms: Date.now() - started, error: err.status ?? err.message, items: [] });
  }
}

// Side-by-side table: one column per model.
const COL = 34;
const cell = (s) => String(s).slice(0, COL - 2).padEnd(COL);
console.log(results.map((r) => cell(r.model)).join(""));
console.log(results.map((r) => cell(r.error ? `FAILED (${r.error})` : `${(r.ms / 1000).toFixed(1)}s · ${r.items.length} items`)).join(""));
console.log(results.map(() => cell("-".repeat(COL - 2))).join(""));
const rows = Math.max(...results.map((r) => r.items.length));
for (let i = 0; i < rows; i++) {
  console.log(results.map((r) => cell(r.items[i] ? `${r.items[i].name} $${r.items[i].estValue}` : "")).join(""));
}
