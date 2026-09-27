import path from "node:path";
import dotenv from "dotenv";

// Load server/.env no matter which directory the server is started from.
// Values already set in the shell win over the file.
dotenv.config({ path: path.join(import.meta.dirname, ".env"), quiet: true });

// Removes connection strings and keys from error messages before they are logged.
export function redact(text) {
  let out = String(text ?? "");
  out = out.replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "mongodb://[hidden]");
  for (const name of ["GEMINI_API_KEY", "ELEVENLABS_API_KEY", "JWT_SECRET", "MONGODB_URI"]) {
    const value = process.env[name];
    if (value && value.length > 6) out = out.split(value).join("[hidden]");
  }
  return out;
}
