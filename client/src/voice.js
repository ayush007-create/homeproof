import { useSyncExternalStore } from "react";
import { api } from "./api.js";

// Short spoken summaries by ElevenLabs. Silent when the server has no key,
// when the user muted it, or when anything goes wrong.

const MUTE_KEY = "homeproof-muted";
let available = false;
let muted = readMuted();
let audio = null;
const listeners = new Set();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

const notify = () => listeners.forEach((fn) => fn());
let snapshot = { available, muted };
const getSnapshot = () => snapshot;
const update = () => {
  snapshot = { available, muted };
  notify();
};

export function setVoiceAvailable(value) {
  available = Boolean(value);
  update();
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode */
  }
  if (muted) audio?.pause();
  update();
}

export function useVoice() {
  return useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), getSnapshot);
}

// Phones only allow sound that starts from a tap. Call this inside a tap handler
// (Stop, Upload, Generate) so the audio can play later when the result arrives.
export function unlockAudio() {
  if (!available || muted) return;
  audio ??= new Audio();
  audio.src = SILENT_WAV;
  audio.play().catch(() => {});
}

// Starts fetching the audio now; returns a function that plays it once it's ready.
export function prepareSpeech(text) {
  if (!available || muted || !text) return () => {};
  const ready = api
    .speak(text)
    .then((blob) => (blob ? URL.createObjectURL(blob) : null))
    .catch(() => null);
  return () =>
    ready.then((url) => {
      if (!url || muted) return;
      audio ??= new Audio();
      audio.src = url;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    });
}

export const say = (text) => prepareSpeech(text)();

// For the Summary button. The user tapped it, so it plays even when automatic
// voice is muted. Resolves "done" (finished or stopped), "unavailable" (no
// ElevenLabs key on the server) or "failed".
let stopCurrent = null;
export async function playNow(text, { onPlaying } = {}) {
  stopSpeech();
  audio ??= new Audio();
  audio.src = SILENT_WAV; // phones: start audio inside the tap, before the network wait
  audio.play().catch(() => {});
  if (!available) return "unavailable";

  let blob = null;
  try {
    blob = await api.speak(text);
  } catch {
    /* handled below */
  }
  if (!blob) return "failed"; // the server answers 204 when ElevenLabs fails

  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const finish = (result) => {
      audio.onended = null;
      stopCurrent = null;
      URL.revokeObjectURL(url);
      resolve(result);
    };
    stopCurrent = () => {
      audio.pause();
      finish("done");
    };
    audio.src = url;
    audio.onended = () => finish("done");
    audio.play().then(() => onPlaying?.(), () => finish("failed"));
  });
}

export function stopSpeech() {
  if (stopCurrent) stopCurrent();
}

// A tiny silent WAV, built once, used to unlock audio on phones.
const SILENT_WAV = (() => {
  const samples = 800;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128); // 8-bit silence
  const bytes = new Uint8Array(view.buffer);
  return "data:audio/wav;base64," + btoa(String.fromCharCode(...bytes));
})();
