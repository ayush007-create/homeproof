import { GoogleGenAI, Type } from "@google/genai";
import { CLAUDE_MODEL, claudeEnabled, claudeErrorReason, claudeJson, claudeText } from "./claude.js";

// ---------- settings ----------

export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Backup models, tried in order when the main one fails or is too slow.
// Override with a comma-separated list (run `npm run models` to see names).
export const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-flash-lite-latest")
  .split(",")
  .map((s) => s.trim())
  .filter((m) => m && m !== MODEL);

const MODEL_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS) || 20_000; // per model
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS) || 60_000; // whole scan
const SKIP_MAIN_AFTER_FAILURE_MS = 3 * 60_000;
const SKIP_EXHAUSTED_MODEL_MS = 30 * 60_000; // a model whose daily quota is used up
const SKIP_GEMINI_ACCOUNT_MS = 3 * 60_000; // Gemini account problem (no credit, bad key)
const CLAUDE_RESERVE_MS = 25_000; // time kept free for the Claude backup at the end of a scan

// 429 = rate limit, 500/503 = Google's servers busy. These are worth retrying.
const RETRYABLE = new Set([429, 500, 503]);

const CATEGORIES = ["Electronics", "Furniture", "Appliances", "Clothing", "Accessories", "Decor", "Kitchen", "Other"];
const CONDITIONS = ["new", "good", "fair", "poor"];

const isMock = () => process.env.MOCK_SCAN === "1";

// ---------- prompts ----------

const ITEM_RULES = `List every distinct item a person would want to claim if it were
destroyed or stolen: electronics, furniture, appliances, clothing, shoes,
bags, instruments, sports gear, decor, kitchenware.

Rules:
- One entry per physical item. If the same item appears several times, list it once.
- Skip fixed parts of the building: walls, doors, windows, built-in cabinets, ceiling lights.
- Skip items you cannot identify with reasonable confidence.
- Be specific when the brand or model is visible ("MacBook Pro 14-inch"),
  generic when it is not ("black office chair").
- estValue is the estimated cost to replace it today with a similar item,
  in US dollars. estLow and estHigh give a realistic range around it.
- confidence is between 0 and 1: how sure you are what the item is.
- category: Electronics = devices with a battery or power cord for computing,
  entertainment or communication (laptops, phones, TVs, consoles, speakers,
  cameras, watches). Appliances = powered household machines (fridge, washer,
  microwave, vacuum, hair dryer). Kitchen = cookware, dishes, cups, bottles,
  utensils. Anything without a power source is never Electronics or Appliances.
- hasSerial is true only if the item is a powered device that normally carries a
  manufacturer serial number an insurer could check (laptop, phone, tablet, TV,
  console, camera, smartwatch, major appliance). It is false for everything
  else: bottles, cups, furniture, clothing, decor, cables, chargers, power strips.`;

const framesPrompt = (count, knownItems = []) => `You are a home-inventory assistant helping someone document their
belongings for insurance.

The ${count} photos below come from ONE slow walk-through of ONE room, in order.
Neighbouring photos overlap, so the same object often shows up in several photos.
Count it once.

${ITEM_RULES}
- frame is the number of the photo where the item is seen most clearly.
  Only pick a photo the item is actually in.
- box is where the item is inside THAT photo: [ymin, xmin, ymax, xmax],
  each scaled from 0 to 1000 (top-left is 0,0). Draw it tightly around the item.${knownItemsRule(knownItems)}`;

// "Add items" mode: the room is already in the inventory, the photos are a short
// clip of new things. Only list what isn't on the inventory yet.
function knownItemsRule(knownItems) {
  if (!knownItems.length) return "";
  const list = knownItems.map((it) => `- ${it.name} (${it.category})`).join("\n");
  return `

This room was documented before. These items are ALREADY in the inventory:
${list}

The photos may show some of them again. Do NOT list an item that is already in
the inventory, even if it is named differently or seen from another angle.
List only NEW items. If every item in the photos is already listed, return an
empty items array.`;
}

// Forces Gemini to reply with JSON in exactly this shape.
function itemsSchema(extra) {
  const properties = {
    name: { type: Type.STRING },
    category: { type: Type.STRING, enum: CATEGORIES },
    condition: { type: Type.STRING, enum: CONDITIONS },
    estValue: { type: Type.NUMBER },
    estLow: { type: Type.NUMBER },
    estHigh: { type: Type.NUMBER },
    confidence: { type: Type.NUMBER },
    hasSerial: { type: Type.BOOLEAN },
    ...extra,
  };
  return {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: { type: Type.OBJECT, properties, required: Object.keys(properties) },
      },
    },
    required: ["items"],
  };
}

const JSON_CONFIG = { responseMimeType: "application/json", temperature: 0.2 };

// ---------- client ----------

let client;
function ai() {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error("GEMINI_API_KEY is missing. Add it to server/.env."), {
      userMessage: "The scanner isn't set up yet (missing Gemini key).",
    });
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- scanning from photos (what the app uses) ----------

// frames: [{ data: Buffer, mimeType, time (seconds) }]
// knownItems: items already in the room ("add items" mode); these are left out of the answer.
// Returns { items, modelUsed }. Each item has `frame` (0-based index into frames).
export async function scanFrames(frames, { knownItems = [] } = {}) {
  const label = knownItems.length ? "Add items" : "Room scan";
  if (isMock()) {
    await sleep(1200); // feel like a real scan
    const raw = knownItems.length ? mockNewItems(frames.length, knownItems) : mockFrameItems(frames.length);
    return { items: cleanFrameItems(raw, frames), modelUsed: "mock" };
  }

  const started = Date.now();
  const deadline = started + SCAN_TIMEOUT_MS;
  let raw, model;
  try {
    // With a Claude backup, Gemini stops early enough to leave Claude its turn.
    const geminiDeadline = claudeEnabled() ? deadline - CLAUDE_RESERVE_MS : deadline;
    const result = await generateWithFallback(framesRequest(frames, knownItems), { label, deadline: geminiDeadline });
    raw = parseItems(result.response);
    model = result.model;
  } catch (geminiError) {
    if (!claudeEnabled()) throw geminiError;
    console.log(`${label}: every Gemini model failed, trying ${CLAUDE_MODEL}.`);
    raw = await scanFramesWithClaude(frames, deadline, knownItems, label);
    model = CLAUDE_MODEL;
  }
  const items = dropKnown(cleanFrameItems(raw, frames), knownItems);
  console.log(`${label}: ${items.length} ${knownItems.length ? "new " : ""}items from ${frames.length} photos by ${model} in ${seconds(Date.now() - started)}.`);
  return { items, modelUsed: model };
}

// Safety net for "add items": drops anything named exactly like an item the room already has.
function dropKnown(items, knownItems) {
  const known = new Set(knownItems.map((it) => String(it.name).trim().toLowerCase()));
  return items.filter((it) => !known.has(it.name.toLowerCase()));
}

// The same photos, prompt and item format, sent to Claude in one request.
async function scanFramesWithClaude(frames, deadline, knownItems, label) {
  const timeoutMs = deadline - Date.now();
  const parts = [{ text: framesPrompt(frames.length, knownItems) }];
  frames.forEach((f, i) => {
    parts.push({ text: `Frame ${i + 1} (${mmss(f.time)}):` });
    parts.push({ image: f.data, mimeType: f.mimeType });
  });
  const started = Date.now();
  try {
    const out = await claudeJson({ parts, schema: CLAUDE_ITEMS_SCHEMA, timeoutMs });
    console.log(`${label}: ${CLAUDE_MODEL} answered in ${seconds(Date.now() - started)}.`);
    return out.items ?? [];
  } catch (err) {
    const reason = claudeErrorReason(err);
    console.warn(`${label}: ${CLAUDE_MODEL} failed after ${seconds(Date.now() - started)} (${reason}).`);
    const timedOut = reason === "timed out";
    throw Object.assign(new Error(`Claude backup failed: ${reason}`), {
      timedOut,
      userMessage: timedOut ? "The scan took too long. Please try again." : "We couldn't analyze those photos. Please try again.",
    });
  }
}

// Standard JSON Schema for Claude's structured output (same fields as the Gemini schema).
const CLAUDE_ITEMS_SCHEMA = (() => {
  const properties = {
    name: { type: "string" },
    category: { type: "string", enum: CATEGORIES },
    condition: { type: "string", enum: CONDITIONS },
    estValue: { type: "number" },
    estLow: { type: "number" },
    estHigh: { type: "number" },
    confidence: { type: "number" },
    hasSerial: { type: "boolean" },
    frame: { type: "integer" },
    box: { type: "array", items: { type: "integer" } },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties },
      },
    },
  };
})();

// Sends the photos to one specific model, no fallback. Used by `npm run compare`.
export async function scanFramesWithModel(model, frames, timeoutMs = 90_000) {
  const response = await callModel(model, framesRequest(frames), timeoutMs, "Compare");
  return cleanFrameItems(parseItems(response), frames);
}

// One request: the instructions, then "Frame N (MM:SS):" followed by each photo.
function framesRequest(frames, knownItems = []) {
  const parts = [{ text: framesPrompt(frames.length, knownItems) }];
  frames.forEach((f, i) => {
    parts.push({ text: `Frame ${i + 1} (${mmss(f.time)}):` });
    parts.push({ inlineData: { mimeType: f.mimeType, data: f.data.toString("base64") } });
  });
  return {
    contents: [{ role: "user", parts }],
    config: { ...JSON_CONFIG, responseSchema: itemsSchema({
      frame: { type: Type.INTEGER },
      box: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    }) },
  };
}

function parseItems(response) {
  try {
    return JSON.parse(response.text).items ?? [];
  } catch {
    throw Object.assign(new Error("Gemini returned something that isn't valid JSON."), {
      userMessage: "The scan came back garbled. Please try again.",
    });
  }
}

// Guards against odd values so the UI never shows NaN, negative prices or missing photos.
function cleanValues(it) {
  const money = (n) => Math.max(0, Math.round(Number(n) || 0));
  const estValue = money(it.estValue);
  const estLow = money(it.estLow) || estValue;
  return {
    name: String(it.name).trim().slice(0, 120),
    category: CATEGORIES.includes(it.category) ? it.category : "Other",
    condition: CONDITIONS.includes(it.condition) ? it.condition : "good",
    estValue,
    estLow: Math.min(estLow, estValue),
    estHigh: Math.max(money(it.estHigh), estValue),
    confidence: Math.min(1, Math.max(0, Number(it.confidence) || 0)),
    // Gemini's answer; fake/demo items without one fall back to their category.
    hasSerial: typeof it.hasSerial === "boolean" ? it.hasSerial : ["Electronics", "Appliances"].includes(it.category),
  };
}

function dropDuplicates(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = it.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const hasName = (it) => it && typeof it.name === "string" && it.name.trim();

// A valid box is [ymin, xmin, ymax, xmax] on a 0–1000 scale; anything else is dropped
// (the photo is then shown uncropped).
function cleanBox(box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const [y1, x1, y2, x2] = box.map((n) => Math.min(1000, Math.max(0, Math.round(Number(n)))));
  if ([y1, x1, y2, x2].some(Number.isNaN) || y2 - y1 < 10 || x2 - x1 < 10) return null;
  return [y1, x1, y2, x2];
}

function cleanFrameItems(items, frames) {
  const last = Math.max(0, frames.length - 1);
  return dropDuplicates(
    items.filter(hasName).map((it) => {
      // The model counts photos from 1; we store a 0-based index. Clamp bad numbers.
      const frame = Math.min(last, Math.max(0, Math.round(Number(it.frame) || 1) - 1));
      return { ...cleanValues(it), frame, timestamp: mmss(frames[frame]?.time), box: cleanBox(it.box) };
    })
  ).sort((a, b) => a.frame - b.frame);
}

// ---------- claim report summary ----------

// A short plain-language summary written only from the item list.
// Falls back to a template sentence if Gemini is unavailable.
export async function writeReportSummary({ homeName, event, rooms }) {
  const fallback = templateSummary({ homeName, rooms });
  if (isMock() || (!process.env.GEMINI_API_KEY && !claudeEnabled())) return fallback;

  const facts = {
    home: homeName,
    event: event || "not specified",
    rooms: rooms.map((r) => ({
      room: r.name,
      items: r.items.map((it) => ({ name: it.name, estimatedValueUSD: it.estValue })),
    })),
    totalEstimatedValueUSD: rooms.reduce((s, r) => s + r.total, 0),
  };
  const prompt = `Write a short summary (2 or 3 sentences, plain language) for the top of a
home inventory claim report. Use ONLY the facts in the JSON below. Do not invent
details about the event, damage, dates, people or items. Mention the number of
items and rooms, the total estimated replacement value, and the two or three most
valuable items. Never use the words "certified", "appraised" or "appraisal".
Reply with the summary text only.

${JSON.stringify(facts)}`;

  let text = "";
  try {
    const { response } = await generateWithFallback(
      { contents: prompt, config: { temperature: 0.3 } },
      { label: "Report summary", deadline: Date.now() + 15_000, modelTimeoutMs: 10_000 }
    );
    text = response.text || "";
  } catch (err) {
    if (claudeEnabled()) {
      try {
        text = await claudeText({ prompt, timeoutMs: 10_000 });
        console.log(`Report summary: answered by backup ${CLAUDE_MODEL}.`);
      } catch (claudeErr) {
        console.warn(`Report summary: ${CLAUDE_MODEL} failed (${claudeErrorReason(claudeErr)}).`);
      }
    }
    if (!text) console.warn("Report summary: using template sentence.", err.message);
  }
  text = text.trim().replace(/\s+/g, " ");
  if (!text || /certif|apprais/i.test(text)) return fallback;
  return text.slice(0, 900);
}

function templateSummary({ homeName, rooms }) {
  const items = rooms.flatMap((r) => r.items);
  const total = items.reduce((s, it) => s + (it.estValue || 0), 0);
  const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const top = [...items].sort((a, b) => b.estValue - a.estValue).slice(0, 3);
  let text = `This report lists ${items.length} item${items.length === 1 ? "" : "s"} across ${rooms.length} room${
    rooms.length === 1 ? "" : "s"
  } at ${homeName}, with a total estimated replacement value of ${usd(total)}.`;
  if (top.length) {
    text += ` The most valuable items are ${top.map((it) => `${it.name} (${usd(it.estValue)})`).join(", ")}.`;
  }
  return text;
}

// ---------- calling Gemini with time limits and backup models ----------

let mainFailedAt = 0;
let geminiAccountDownUntil = 0;
const exhaustedUntil = new Map(); // model -> time its daily quota is assumed used up until

// 401/402/403: the Gemini account itself can't be used (bad key, no credit, blocked),
// so every Gemini model would fail the same way.
const isAccountProblem = (err) => [401, 402, 403].includes(err?.status);
// Google's daily-quota 429 says "PerDay"; retrying won't help until the quota resets.
const isDailyQuota = (err) => err?.status === 429 && /PerDay/i.test(String(err.message));

// Tries the main model, then each backup, within the overall deadline.
// If the main model failed recently, it is skipped for a few minutes.
async function generateWithFallback(request, { label, deadline, modelTimeoutMs = MODEL_TIMEOUT_MS }) {
  if (Date.now() < geminiAccountDownUntil) {
    throw Object.assign(new Error(`${label}: Gemini account unavailable (recent credit/key error)`), {
      userMessage: "The scanner isn't available right now. Please try again later.",
    });
  }
  const skipMain = Date.now() - mainFailedAt < SKIP_MAIN_AFTER_FAILURE_MS && FALLBACK_MODELS.length > 0;
  const models = (skipMain ? FALLBACK_MODELS : [MODEL, ...FALLBACK_MODELS]).filter((m) => {
    const skip = Date.now() < (exhaustedUntil.get(m) ?? 0);
    if (skip) console.log(`${label}: ${m} used up its daily quota, skipping it.`);
    return !skip;
  });
  if (skipMain) console.log(`${label}: ${MODEL} failed recently, going straight to ${FALLBACK_MODELS[0]}.`);

  let lastError;
  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    try {
      const response = await callModel(model, request, Math.min(modelTimeoutMs, remaining), label);
      if (model !== MODEL) console.log(`${label}: answered by backup model ${model}.`);
      return { response, model };
    } catch (err) {
      lastError = err;
      if (model === MODEL) mainFailedAt = Date.now();
      if (err.userMessage && !err.status && !err.timedOut) throw err; // e.g. missing key
      if (isDailyQuota(err)) exhaustedUntil.set(model, Date.now() + SKIP_EXHAUSTED_MODEL_MS);
      if (isAccountProblem(err)) {
        console.warn(`${label}: Gemini account error ${err.status} (check billing/credit in AI Studio). Skipping Gemini for 3 minutes.`);
        geminiAccountDownUntil = Date.now() + SKIP_GEMINI_ACCOUNT_MS;
        break;
      }
    }
  }

  const timedOut = !lastError || lastError.timedOut || Date.now() >= deadline - 1500;
  const error = new Error(`${label} failed: ${lastError?.message ?? "out of time"}`);
  error.timedOut = timedOut;
  error.userMessage = timedOut
    ? "The scan took too long. Please try again."
    : RETRYABLE.has(lastError?.status)
      ? "Gemini is busy right now. Wait a moment and try again."
      : "We couldn't analyze those photos. Please try again.";
  throw error;
}

// Turning "thinking" off roughly halves the time a flash model takes to list
// items. Some models reject this setting (400); those are remembered and
// called without it from then on.
const THINKING_OFF = { thinkingBudget: 0 };
const noThinkingControl = new Set();

// Calls one model, retrying 429/5xx with backoff while its time budget lasts.
async function callModel(model, request, budgetMs, label) {
  const until = Date.now() + budgetMs;
  for (let attempt = 1; ; attempt++) {
    const fast = !noThinkingControl.has(model);
    const left = until - Date.now();
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error(`timed out after ${seconds(left)}`), { timedOut: true }));
      }, left);
    });
    const started = Date.now();
    try {
      const response = await Promise.race([
        ai().models.generateContent({
          ...request,
          model,
          config: { ...request.config, ...(fast && { thinkingConfig: THINKING_OFF }), abortSignal: controller.signal },
        }),
        timeout,
      ]);
      console.log(`${label}: ${model} answered in ${seconds(Date.now() - started)}.`);
      return response;
    } catch (err) {
      if (fast && err?.status === 400) {
        console.log(`${label}: ${model} doesn't accept the thinking setting. Retrying without it.`);
        noThinkingControl.add(model);
        continue;
      }
      console.warn(`${label}: ${model} failed after ${seconds(Date.now() - started)} (${err.status ?? err.message}).`);
      if (!RETRYABLE.has(err?.status) || isDailyQuota(err)) throw err;
      const wait = 1000 * 2 ** (attempt - 1) + Math.random() * 400;
      if (Date.now() + wait + 3000 > until) throw err; // no time left for another try
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------- fake results (MOCK_SCAN=1) ----------

const MOCK_ITEMS = [
  { name: "MacBook Pro 14-inch", category: "Electronics", condition: "good", estValue: 1800, estLow: 1500, estHigh: 2100, confidence: 0.9 },
  { name: "27-inch monitor", category: "Electronics", condition: "good", estValue: 250, estLow: 180, estHigh: 320, confidence: 0.85 },
  { name: "Black office chair", category: "Furniture", condition: "fair", estValue: 180, estLow: 120, estHigh: 250, confidence: 0.8 },
  { name: "Wooden desk", category: "Furniture", condition: "good", estValue: 220, estLow: 150, estHigh: 300, confidence: 0.75 },
  { name: "Nike running shoes", category: "Clothing", condition: "good", estValue: 110, estLow: 80, estHigh: 140, confidence: 0.7 },
  { name: "Backpack", category: "Accessories", condition: "good", estValue: 60, estLow: 40, estHigh: 90, confidence: 0.7 },
];

// Spreads the fake items across the photos that were actually sent.
function mockFrameItems(count) {
  return MOCK_ITEMS.map((it, i) => ({
    ...it,
    frame: 1 + Math.round((i * Math.max(0, count - 1)) / (MOCK_ITEMS.length - 1)),
  }));
}

// "Add items" with MOCK_SCAN=1: a few extra things the room doesn't have yet.
const MOCK_NEW_ITEMS = [
  { name: "Desk lamp", category: "Decor", condition: "new", estValue: 45, estLow: 30, estHigh: 60, confidence: 0.8 },
  { name: "Bluetooth speaker", category: "Electronics", condition: "new", estValue: 120, estLow: 90, estHigh: 150, confidence: 0.8 },
  { name: "Yoga mat", category: "Other", condition: "good", estValue: 35, estLow: 25, estHigh: 50, confidence: 0.75 },
  { name: "Standing fan", category: "Appliances", condition: "good", estValue: 70, estLow: 50, estHigh: 90, confidence: 0.8 },
];

function mockNewItems(count, knownItems) {
  const known = new Set(knownItems.map((it) => it.name.toLowerCase()));
  return MOCK_NEW_ITEMS.filter((it) => !known.has(it.name.toLowerCase()))
    .slice(0, 2)
    .map((it, i) => ({ ...it, frame: 1 + Math.min(count - 1, i * 2) }));
}

// Lets a quick script swap in a fake Gemini client to test the retry logic.
export function _setClientForTests(fake) {
  client = fake;
}
