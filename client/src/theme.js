import { useSyncExternalStore } from "react";

// Light / dark mode. Follows the phone's setting until the user taps the
// toggle; their choice is saved and set on <html data-theme="…">.
// (index.html applies the saved choice before the page draws, so there's no flash.)

const KEY = "homeproof-theme";
const listeners = new Set();
const media = window.matchMedia("(prefers-color-scheme: dark)");

function saved() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// The theme actually showing: "light" or "dark".
function current() {
  const choice = saved();
  if (choice === "light" || choice === "dark") return choice;
  return media.matches ? "dark" : "light";
}

export function toggleTheme() {
  const next = current() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: still switch for this visit */
  }
  document.documentElement.dataset.theme = next;
  listeners.forEach((fn) => fn());
}

media.addEventListener("change", () => listeners.forEach((fn) => fn()));

export function useTheme() {
  return useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), current);
}
