import { redact } from "./env.js";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import { authRouter } from "./auth.js";
import { homesRouter } from "./homes.js";
import { HOME_RADIUS_M, MAX_ACCURACY_M, geoRouter, locationRequired } from "./geo.js";
import { reportRouter } from "./report.js";
import { voiceRouter, voiceEnabled } from "./voice.js";
import { connectDb, usingMongo } from "./store.js";
import { seedDemo } from "./demo.js";
import { MODEL, FALLBACK_MODELS } from "./gemini.js";
import { CLAUDE_MODEL, claudeEnabled } from "./claude.js";

if (!process.env.JWT_SECRET) {
  console.error(`
JWT_SECRET is missing, so HomeProof can't sign login sessions.
Add a long random value to server/.env, for example:

  JWT_SECRET=<paste the output of the command below>

Generate one with:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
`);
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1); // Render/Railway sit behind a proxy; needed for secure cookies

// Cookies are sent cross-origin only to the frontend(s) listed in CLIENT_ORIGIN.
const origins = (process.env.CLIENT_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true, exposedHeaders: ["X-Report-Id"] }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Tells the client which optional features are switched on.
app.get("/api/config", (req, res) =>
  res.json({
    voice: voiceEnabled(),
    location: { required: locationRequired(), radiusM: HOME_RADIUS_M, maxAccuracyM: MAX_ACCURACY_M },
  })
);

app.use("/api/auth", authRouter);
app.use("/api", voiceRouter);
app.use("/api", reportRouter);
app.use("/api", geoRouter);
app.use("/api", homesRouter);

// In production the server also serves the built app (client/dist), so the site
// and the API share one address: no cross-site cookies, one URL for the QR code.
const clientDist = path.resolve(import.meta.dirname, "../client/dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  // Files in /assets have a content hash in their name, so they can be cached for good.
  app.use("/assets", express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(clientDist, { index: false }));
  // Every other page is the React app (it handles /homes, /login, …).
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FILE_COUNT";
    return res.status(tooBig ? 413 : 400).json({ error: tooBig ? "Too many or too large files." : "Upload failed." });
  }
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
  console.error(redact(err?.stack || err));
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = Number(process.env.PORT) || 3001;
connectDb()
  .then(async () => {
    // In-memory mode starts empty on every restart, so add the demo account automatically.
    if (!usingMongo()) {
      const demo = await seedDemo();
      console.log(`Demo account (in memory): ${demo.email} / ${demo.password}`);
    }
  })
  .then(() =>
    app.listen(port, () => {
      console.log(`HomeProof API on http://localhost:${port}`);
      console.log(
        `Scanner: ${process.env.MOCK_SCAN === "1" ? "MOCK (fake items)" : `${MODEL}, backup ${[...FALLBACK_MODELS, ...(claudeEnabled() ? [CLAUDE_MODEL] : [])].join(", ") || "none"}`}` +
          ` · Voice: ${voiceEnabled() ? "on" : "off"}` +
          ` · Location check: ${locationRequired() ? `on (${HOME_RADIUS_M} m)` : "OFF"}`
      );
    })
  )
  .catch((err) => {
    console.error("Could not connect to MongoDB:", redact(err.message));
    console.error("Check MONGODB_URI in server/.env and Atlas Network Access (allow your IP).");
    process.exit(1);
  });
