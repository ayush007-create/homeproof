import express from "express";
import { requireAuth } from "./auth.js";

// ElevenLabs text-to-speech. Optional: without ELEVENLABS_API_KEY the app simply has no voice.

const VOICE_ID = () => process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; // "George", a premade voice
const MODEL_ID = "eleven_flash_v2_5"; // fastest ElevenLabs model
// Speaking pace: 1.0 is ElevenLabs' normal speed, 0.7 the slowest. A bit slower reads calmer.
const SPEED = () => Math.min(1.2, Math.max(0.7, Number(process.env.ELEVENLABS_SPEED) || 0.85));
const MAX_CHARS = 300;
const CACHE_SIZE = 100;

export const voiceEnabled = () => Boolean(process.env.ELEVENLABS_API_KEY);

// The same sentence is only paid for once.
const cache = new Map();

async function textToSpeech(text) {
  if (cache.has(text)) return cache.get(text);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE_ID())}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: { speed: SPEED() } }),
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}`);
  const audio = Buffer.from(await res.arrayBuffer());
  cache.set(text, audio);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value); // drop the oldest
  return audio;
}

export const voiceRouter = express.Router();

// Returns MP3 audio, or 204 (no content) when voice is off or fails, so the app stays quiet.
voiceRouter.post("/speak", requireAuth, async (req, res) => {
  const text = String(req.body?.text ?? "").trim().slice(0, MAX_CHARS);
  if (!text || !voiceEnabled()) return res.status(204).end();
  try {
    const audio = await textToSpeech(text);
    res.set("Content-Type", "audio/mpeg").send(audio);
  } catch (err) {
    console.warn("Voice skipped:", err.message);
    res.status(204).end();
  }
});
