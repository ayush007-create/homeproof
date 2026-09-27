// Lists the Gemini models your API key can use for generateContent.
// Run with: npm run models
import "./env.js";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing. Add it to server/.env first.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pager = await ai.models.list();

const names = [];
for await (const model of pager) {
  if (model.supportedActions?.includes("generateContent")) {
    names.push(model.name.replace(/^models\//, ""));
  }
}

console.log("Models you can put in GEMINI_MODEL or GEMINI_FALLBACK_MODELS:\n");
for (const name of names.sort()) console.log("  " + name);
console.log("\nFor HomeProof, pick ones with \"flash\" in the name.");
