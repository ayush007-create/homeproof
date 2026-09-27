import express from "express";
import multer from "multer";
import { requireAuth } from "./auth.js";
import { scanFrames } from "./gemini.js";
import { HOME_RADIUS_M, boxAround, checkRecordingLocation, readPlaceToken, sameSpot, unitKey, unitLabel } from "./geo.js";
import * as store from "./store.js";

// Every route here needs a logged-in user, and every home/room/photo is
// looked up together with the user's id, so nobody can reach someone else's data.

export const MAX_FRAMES = 30;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);

export const homesRouter = express.Router();
homesRouter.use(requireAuth);

// Photos from a scan stay in memory; only the ones items point to are saved.
const framesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: MAX_FRAMES },
});

const cleanText = (value, max) => String(value ?? "").trim().slice(0, max);

// Loads the home (checking the owner) into req.home, or answers 404.
async function loadHome(req, res, next) {
  req.home = await store.getHome(req.userId, req.params.homeId);
  if (!req.home) return res.status(404).json({ error: "Home not found." });
  next();
}

// Loads the room (inside the user's home) into req.room, or answers 404.
async function loadRoom(req, res, next) {
  req.room = await store.getRoom(req.home._id, req.params.roomId);
  if (!req.room) return res.status(404).json({ error: "Room not found." });
  next();
}

// ---------- homes ----------

homesRouter.get("/homes", async (req, res) => {
  res.json({ homes: await store.listHomes(req.userId) });
});

// The address is required and comes as a signed lookup result (placeToken from
// /api/geo/search or /api/geo/reverse), so its coordinates can be trusted.
homesRouter.post("/homes", async (req, res) => {
  const name = cleanText(req.body?.name, 80);
  if (!name) return res.status(400).json({ error: "Give your home a name.", field: "name" });
  const place = readPlaceToken(req.body?.placeToken);
  if (!place) return res.status(400).json({ error: "Add the address: use your current location or search for it.", field: "address" });
  const fields = placeFields(place, req.body?.unit);
  const conflict = await findConflict(fields, req.userId);
  if (conflict) return res.status(409).json({ error: conflict, field: "address" });
  try {
    res.status(201).json({ home: await store.createHome(req.userId, { name, ...fields }) });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: ADDRESS_TAKEN, field: "address" }); // added at the same moment
    throw err;
  }
});

// What a home stores about its address and location.
function placeFields(place, rawUnit) {
  const unit = unitLabel(cleanText(rawUnit, 30));
  const uKey = unitKey(unit);
  // The unit goes after the street: "1450 Brickell Avenue, Apt 2104, Miami, FL 33131".
  const [street, ...rest] = place.address.split(", ");
  return {
    address: [street, unit, ...rest].filter(Boolean).join(", "),
    unit: unit || undefined,
    location: { lat: place.lat, lng: place.lng },
    locationSource: place.source,
    radiusM: HOME_RADIUS_M,
    addressKey: place.key ? `${place.key}#${uKey}` : undefined,
    unitKey: uKey || undefined,
  };
}

const ADDRESS_TAKEN = "This address is already registered on HomeProof. Each home can only be added once.";

// Each home once across all users: no two homes with the same address, and none
// at the same spot (unless they're different apartments). Returns an error or null.
async function findConflict(fields, userId, exceptHomeId) {
  const other = (h) => h && String(h._id) !== String(exceptHomeId);
  const mine = (h) => String(h.userId) === String(userId);
  if (fields.addressKey) {
    const h = await store.findHomeByAddressKey(fields.addressKey);
    if (other(h)) return mine(h) ? `You've already added this home ("${h.name}").` : ADDRESS_TAKEN;
  }
  const near = await store.findHomesInBox(boxAround(fields.location));
  const h = near.find((n) => other(n) && sameSpot(fields, n));
  if (!h) return null;
  if (mine(h)) return `You've already added a home at this spot ("${h.name}").`;
  return "Another home is already registered at this exact spot. If you live in an apartment, add your apartment or unit number.";
}

homesRouter.get("/homes/:homeId", loadHome, async (req, res) => {
  res.json({ home: await store.getHomeDetail(req.userId, req.home._id) });
});

homesRouter.patch("/homes/:homeId", loadHome, async (req, res) => {
  const changes = {};
  if (req.body?.name !== undefined) {
    changes.name = cleanText(req.body.name, 80);
    if (!changes.name) return res.status(400).json({ error: "The name can't be empty.", field: "name" });
  }
  if (req.body?.placeToken !== undefined) {
    // Recordings were verified against the current address, so it's locked once there are any.
    if (req.home.location && (await store.homeHasScans(req.home._id))) {
      return res.status(409).json({
        error: "The address can't be changed after rooms have been recorded here, because those recordings were verified at this address.",
        field: "address",
      });
    }
    const place = readPlaceToken(req.body.placeToken);
    if (!place) return res.status(400).json({ error: "Use your current location or search for the address again.", field: "address" });
    Object.assign(changes, placeFields(place, req.body.unit));
    const conflict = await findConflict(changes, req.userId, req.home._id);
    if (conflict) return res.status(409).json({ error: conflict, field: "address" });
  }
  try {
    await store.updateHome(req.userId, req.home._id, changes);
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: ADDRESS_TAKEN, field: "address" });
    throw err;
  }
  res.json({ home: await store.getHomeDetail(req.userId, req.home._id) });
});

homesRouter.delete("/homes/:homeId", loadHome, async (req, res) => {
  await store.deleteHome(req.userId, req.home._id);
  res.json({ ok: true });
});

// ---------- rooms ----------

homesRouter.post("/homes/:homeId/rooms", loadHome, async (req, res) => {
  const name = cleanText(req.body?.name, 60);
  if (!name) return res.status(400).json({ error: "Give the room a name.", field: "name" });
  res.status(201).json({ room: await store.createRoom(req.home._id, { name }) });
});

homesRouter.get("/homes/:homeId/rooms/:roomId", loadHome, loadRoom, (req, res) => {
  res.json({ room: req.room });
});

homesRouter.patch("/homes/:homeId/rooms/:roomId", loadHome, loadRoom, async (req, res) => {
  const name = cleanText(req.body?.name, 60);
  if (!name) return res.status(400).json({ error: "The name can't be empty.", field: "name" });
  res.json({ room: await store.updateRoom(req.home._id, req.room._id, { name }) });
});

homesRouter.delete("/homes/:homeId/rooms/:roomId", loadHome, loadRoom, async (req, res) => {
  await store.deleteRoom(req.home._id, req.room._id);
  res.json({ ok: true });
});

// ---------- scanning ----------

// The phone sends up to 30 photos (form field "frames"), "times": a JSON array
// with the second in the walk-through each photo was taken at, and "location":
// the location fixes taken while recording (they must all be at the home).
// ?mode=add: a short clip of new things. The items found are added to the room's
// list (things already listed are skipped) instead of replacing it.
homesRouter.post(
  "/homes/:homeId/rooms/:roomId/scan",
  loadHome,
  loadRoom,
  framesUpload.array("frames", MAX_FRAMES),
  async (req, res) => {
    const files = req.files ?? [];
    if (!files.length) return res.status(400).json({ error: "No photos received." });
    if (files.some((f) => !PHOTO_TYPES.has(f.mimetype))) {
      return res.status(400).json({ error: "Photos must be JPEG or PNG." });
    }
    let times = [];
    try {
      times = JSON.parse(req.body.times || "[]");
    } catch {
      /* fall back to 2 s apart */
    }
    // Checked before calling Gemini, so a recording made elsewhere costs nothing.
    const place = checkRecordingLocation(req.home, req.body.location);
    if (!place.ok) return res.status(place.status).json({ error: place.error, code: place.code });

    const frames = files.map((f, i) => ({
      data: f.buffer,
      mimeType: f.mimetype,
      time: Number.isFinite(Number(times[i])) ? Number(times[i]) : i * 2,
    }));

    const adding = req.query.mode === "add";
    let result;
    try {
      result = await scanFrames(frames, { knownItems: adding ? req.room.items : [] });
    } catch (err) {
      console.error("Scan failed:", err.message);
      return res.status(err.timedOut ? 504 : 502).json({ error: err.userMessage || "We couldn't analyze those photos. Please try again." });
    }

    // Save only the photos that items point to (several items can share one).
    const photoIds = new Map();
    for (const item of result.items) {
      if (!photoIds.has(item.frame)) {
        const f = frames[item.frame];
        photoIds.set(item.frame, await store.savePhoto({ data: f.data, mimeType: f.mimeType, roomId: req.room._id, userId: req.userId }));
      }
      item.photoId = photoIds.get(item.frame);
    }

    if (adding) {
      const { room, addedIds } = await store.addRoomItems(req.home._id, req.room._id, result.items, result.modelUsed, place.proof);
      return res.json({ room, addedIds });
    }
    const room = await store.replaceRoomItems(req.home._id, req.room._id, result.items, result.modelUsed, place.proof);
    res.json({ room });
  }
);

// ---------- items ----------

homesRouter.patch("/homes/:homeId/rooms/:roomId/items/:itemId", loadHome, loadRoom, async (req, res) => {
  const room = await store.updateItem(req.home._id, req.room._id, req.params.itemId, req.body ?? {});
  if (!room) return res.status(404).json({ error: "Item not found." });
  res.json({ room });
});

homesRouter.delete("/homes/:homeId/rooms/:roomId/items/:itemId", loadHome, loadRoom, async (req, res) => {
  const room = await store.deleteItem(req.home._id, req.room._id, req.params.itemId);
  if (!room) return res.status(404).json({ error: "Item not found." });
  res.json({ room });
});

// ---------- photos ----------

homesRouter.get("/photos/:id", async (req, res) => {
  const photo = await store.getPhoto(req.params.id);
  if (!photo || String(photo.userId) !== String(req.userId)) {
    return res.status(404).json({ error: "Photo not found." });
  }
  res.set("Content-Type", photo.mimeType);
  res.set("Cache-Control", "private, max-age=86400");
  res.send(photo.data);
});
