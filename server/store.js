import crypto from "node:crypto";
import mongoose from "mongoose";
import { redact } from "./env.js";

// Uses MongoDB Atlas when MONGODB_URI is set. Without it, everything lives in
// memory (lost on restart) so the app still starts for local UI work.
//
// Data model: a user has many homes, a home has many rooms, a room has its
// items embedded. Item photos live in their own collection. Totals are never
// stored: they are always added up from the items.

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: String,
  avatarUrl: String,
  createdAt: { type: Date, default: Date.now },
});

const pointSchema = new Schema({ lat: Number, lng: Number }, { _id: false });

const homeSchema = new Schema({
  userId: { type: ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, default: "", trim: true }, // as shown, unit included
  unit: String, // apartment / unit, as shown ("Apt 2104")
  // Where the home is. Recording only unlocks within radiusM of this point.
  location: { type: pointSchema, default: undefined },
  locationSource: String, // "gps" (the owner's phone at home) or "address" (looked up)
  radiusM: Number,
  // Each address can be registered once across all users (see geo.js for the format).
  addressKey: { type: String, unique: true, sparse: true },
  unitKey: String, // normalized unit: two homes at one spot are allowed if these differ
  createdAt: { type: Date, default: Date.now },
});
homeSchema.index({ "location.lat": 1, "location.lng": 1 });

const itemSchema = new Schema({
  name: String,
  category: String,
  condition: String,
  estValue: Number,
  estLow: Number,
  estHigh: Number,
  confidence: Number,
  frame: Number, // index of the photo the item was picked from
  box: { type: [Number], default: undefined }, // where the item is in that photo: [ymin, xmin, ymax, xmax], 0–1000
  timestamp: String, // MM:SS in the walk-through
  photoId: { type: ObjectId, ref: "Photo" },
  editedByUser: { type: Boolean, default: false }, // name or value corrected by the owner
  hasSerial: Boolean, // Gemini: a device that carries a manufacturer serial number
  serialNumber: { type: String, default: "" }, // added by the owner
  addedAt: Date, // set when the item came from an "add items" clip after the first scan
});

const roomSchema = new Schema({
  homeId: { type: ObjectId, ref: "Home", required: true, index: true },
  name: { type: String, required: true, trim: true },
  items: [itemSchema],
  scannedAt: Date, // last full scan
  itemsAddedAt: Date, // last "add items" clip since then
  modelUsed: String,
  // Proof the last recording was made at the home (no coordinates are stored).
  locationProof: {
    type: new Schema({ verifiedAt: Date, fixes: Number, maxDistanceM: Number }, { _id: false }),
    default: undefined,
  },
  createdAt: { type: Date, default: Date.now },
});

const photoSchema = new Schema({
  data: Buffer,
  mimeType: String,
  roomId: { type: ObjectId, index: true },
  userId: { type: ObjectId, index: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Home = mongoose.model("Home", homeSchema);
const Room = mongoose.model("Room", roomSchema);
const Photo = mongoose.model("Photo", photoSchema);

let useMongo = false;
const memory = { users: new Map(), homes: new Map(), rooms: new Map(), photos: new Map() };

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI set. Storing data in memory (lost on restart).");
    return;
  }
  // If the connection string doesn't name a database, use "homeproof".
  let dbName;
  try {
    const path = new URL(uri).pathname;
    if (!path || path === "/") dbName = "homeproof";
  } catch {
    dbName = "homeproof";
  }
  try {
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15_000 });
  } catch (err) {
    throw new Error(redact(err.message));
  }
  useMongo = true;
  console.log("Connected to MongoDB Atlas.");
}

export async function disconnectDb() {
  if (useMongo) await mongoose.disconnect();
}

export const usingMongo = () => useMongo;

// ---------- helpers ----------

const newId = () => crypto.randomUUID();
const copy = (doc) => (doc ? structuredClone(doc) : null);
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const validId = (id) => (useMongo ? mongoose.isValidObjectId(id) : typeof id === "string");

export function roomTotals(room) {
  const items = room.items || [];
  const total = items.reduce((sum, it) => sum + (it.estValue || 0), 0);
  const top = items.reduce((best, it) => (!best || it.estValue > best.estValue ? it : best), null);
  return { itemCount: items.length, total, topItem: top };
}

// What the Home screen needs about a room (no item list).
export function roomSummary(room) {
  const { itemCount, total, topItem } = roomTotals(room);
  return {
    _id: room._id,
    name: room.name,
    itemCount,
    total,
    scannedAt: room.scannedAt ?? null,
    itemsAddedAt: room.itemsAddedAt ?? null,
    modelUsed: room.modelUsed ?? null,
    topItemName: topItem?.name ?? null,
    topPhotoId: topItem?.photoId ?? null,
    topPhotoBox: topItem?.box?.length === 4 ? topItem.box : null,
  };
}

function homeTotals(rooms) {
  const summaries = rooms.map(roomSummary);
  return {
    roomCount: rooms.length,
    documentedRoomCount: rooms.filter((r) => r.scannedAt).length, // rooms that have been scanned
    itemCount: summaries.reduce((s, r) => s + r.itemCount, 0),
    total: summaries.reduce((s, r) => s + r.total, 0),
  };
}

// ---------- users ----------

export async function createUser({ name, email, passwordHash, avatarUrl }) {
  const data = { name, email: email.toLowerCase().trim(), passwordHash, avatarUrl };
  if (useMongo) return (await User.create(data)).toObject();
  const user = { _id: newId(), ...data, createdAt: new Date() };
  memory.users.set(user._id, user);
  return copy(user);
}

export async function findUserByEmail(email) {
  const e = String(email || "").toLowerCase().trim();
  if (useMongo) return User.findOne({ email: e }).lean();
  return copy([...memory.users.values()].find((u) => u.email === e));
}

export async function findUserById(id) {
  if (!validId(id)) return null;
  if (useMongo) return User.findById(id).lean();
  return copy(memory.users.get(id));
}

export async function updateUser(id, changes) {
  if (useMongo) return User.findByIdAndUpdate(id, changes, { returnDocument: "after" }).lean();
  const user = memory.users.get(id);
  if (!user) return null;
  Object.assign(user, changes);
  return copy(user);
}

// ---------- homes ----------

export async function listHomes(userId) {
  let homes, rooms;
  if (useMongo) {
    homes = await Home.find({ userId }).sort({ createdAt: 1 }).lean();
    rooms = await Room.find({ homeId: { $in: homes.map((h) => h._id) } }).lean();
  } else {
    homes = [...memory.homes.values()].filter((h) => h.userId === userId).map(copy);
    rooms = [...memory.rooms.values()];
  }
  return homes.map((home) => ({
    ...home,
    ...homeTotals(rooms.filter((r) => sameId(r.homeId, home._id))),
  }));
}

export async function createHome(userId, { name, address, ...place }) {
  const data = { userId, name, address: address || "", ...place };
  if (useMongo) return (await Home.create(data)).toObject();
  const home = { _id: newId(), ...data, createdAt: new Date() };
  memory.homes.set(home._id, home);
  return copy(home);
}

// Returns the home only if it belongs to this user.
export async function getHome(userId, homeId) {
  if (!validId(homeId)) return null;
  if (useMongo) return Home.findOne({ _id: homeId, userId }).lean();
  const home = memory.homes.get(homeId);
  return home && home.userId === userId ? copy(home) : null;
}

// Home plus a summary of each room and the home total.
export async function getHomeDetail(userId, homeId) {
  const home = await getHome(userId, homeId);
  if (!home) return null;
  const rooms = await listRooms(home._id);
  return { ...home, ...homeTotals(rooms), rooms: rooms.map(roomSummary) };
}

// For the "each address once" rule (see homes.js).
export async function findHomeByAddressKey(addressKey) {
  if (useMongo) return Home.findOne({ addressKey }).lean();
  return copy([...memory.homes.values()].find((h) => h.addressKey === addressKey));
}

export async function findHomesInBox({ minLat, maxLat, minLng, maxLng }) {
  if (useMongo) {
    return Home.find({ "location.lat": { $gte: minLat, $lte: maxLat }, "location.lng": { $gte: minLng, $lte: maxLng } }).lean();
  }
  return [...memory.homes.values()]
    .filter((h) => h.location && h.location.lat >= minLat && h.location.lat <= maxLat && h.location.lng >= minLng && h.location.lng <= maxLng)
    .map(copy);
}

export async function homeHasScans(homeId) {
  return (await listRooms(homeId)).some((r) => r.scannedAt);
}

export async function updateHome(userId, homeId, changes) {
  const home = await getHome(userId, homeId);
  if (!home) return null;
  if (useMongo) {
    // A field set to undefined is removed (e.g. the address key when the new address has none).
    const $set = {}, $unset = {};
    for (const [k, v] of Object.entries(changes)) v === undefined ? ($unset[k] = "") : ($set[k] = v);
    return Home.findByIdAndUpdate(home._id, { $set, ...(Object.keys($unset).length && { $unset }) }, { returnDocument: "after" }).lean();
  }
  Object.assign(memory.homes.get(homeId), changes);
  return copy(memory.homes.get(homeId));
}

export async function deleteHome(userId, homeId) {
  const home = await getHome(userId, homeId);
  if (!home) return false;
  const rooms = await listRooms(home._id);
  for (const room of rooms) await deleteRoom(home._id, room._id);
  if (useMongo) await Home.deleteOne({ _id: home._id });
  else memory.homes.delete(homeId);
  return true;
}

// ---------- rooms ----------

export async function listRooms(homeId) {
  if (useMongo) return Room.find({ homeId }).sort({ createdAt: 1 }).lean();
  return [...memory.rooms.values()]
    .filter((r) => sameId(r.homeId, homeId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(copy);
}

export async function createRoom(homeId, { name }) {
  const data = { homeId, name, items: [], scannedAt: null, modelUsed: null };
  if (useMongo) return (await Room.create(data)).toObject();
  const room = { _id: newId(), ...data, createdAt: new Date() };
  memory.rooms.set(room._id, room);
  return copy(room);
}

// Callers check that the home belongs to the user first; this checks the room is in that home.
export async function getRoom(homeId, roomId) {
  if (!validId(roomId)) return null;
  if (useMongo) return Room.findOne({ _id: roomId, homeId }).lean();
  const room = memory.rooms.get(roomId);
  return room && sameId(room.homeId, homeId) ? copy(room) : null;
}

export async function updateRoom(homeId, roomId, changes) {
  if (!(await getRoom(homeId, roomId))) return null;
  if (useMongo) return Room.findByIdAndUpdate(roomId, changes, { returnDocument: "after" }).lean();
  Object.assign(memory.rooms.get(roomId), changes);
  return copy(memory.rooms.get(roomId));
}

export async function deleteRoom(homeId, roomId) {
  if (!(await getRoom(homeId, roomId))) return false;
  await deletePhotos({ roomId });
  if (useMongo) await Room.deleteOne({ _id: roomId });
  else memory.rooms.delete(String(roomId));
  return true;
}

// Saves a new scan: the old items and their photos are replaced.
// locationProof: from checkRecordingLocation (null when the check is switched off).
export async function replaceRoomItems(homeId, roomId, items, modelUsed, locationProof = null) {
  if (!(await getRoom(homeId, roomId))) return null;
  const keepPhotoIds = items.map((it) => it.photoId).filter(Boolean);
  const changes = { items, scannedAt: new Date(), itemsAddedAt: null, modelUsed, locationProof };
  let room;
  if (useMongo) {
    room = await Room.findByIdAndUpdate(roomId, changes, { returnDocument: "after" }).lean();
  } else {
    const stored = memory.rooms.get(roomId);
    Object.assign(stored, changes, {
      items: items.map((it) => ({ _id: newId(), editedByUser: false, ...it })),
    });
    room = copy(stored);
  }
  await deletePhotos({ roomId, exceptIds: keepPhotoIds });
  return room;
}

// Adds items from an "add items" clip to the ones already there. Nothing is replaced
// and every existing photo stays. Returns { room, addedIds }.
export async function addRoomItems(homeId, roomId, items, modelUsed, locationProof = null) {
  const room = await getRoom(homeId, roomId);
  if (!room) return null;
  const now = new Date();
  // A room that was never scanned counts this clip as its first scan.
  const firstScan = !room.scannedAt;
  const added = items.map((it) => ({
    ...it,
    _id: useMongo ? new mongoose.Types.ObjectId() : newId(),
    editedByUser: false,
    ...(!firstScan && { addedAt: now }),
  }));
  const dates = firstScan ? { scannedAt: now } : { itemsAddedAt: now };
  let updated;
  if (useMongo) {
    updated = await Room.findByIdAndUpdate(
      roomId,
      { $push: { items: { $each: added } }, $set: { ...dates, modelUsed, locationProof } },
      { returnDocument: "after" }
    ).lean();
  } else {
    const stored = memory.rooms.get(roomId);
    stored.items.push(...added);
    Object.assign(stored, dates, { modelUsed, locationProof });
    updated = copy(stored);
  }
  return { room: updated, addedIds: added.map((it) => String(it._id)) };
}

function cleanItemChanges(item, changes) {
  const allowed = {};
  if (typeof changes.name === "string" && changes.name.trim()) {
    allowed.name = changes.name.trim().slice(0, 120);
  }
  const value = Number(changes.estValue);
  if (changes.estValue !== undefined && Number.isFinite(value) && value >= 0) {
    allowed.estValue = Math.round(value);
    // Keep the low–high range around the new value, in the same proportion as before.
    const ratio = item.estValue > 0 ? allowed.estValue / item.estValue : 1;
    allowed.estLow = item.estValue > 0 ? Math.round(item.estLow * ratio) : allowed.estValue;
    allowed.estHigh = item.estValue > 0 ? Math.round(item.estHigh * ratio) : allowed.estValue;
  }
  if (typeof changes.serialNumber === "string") {
    // Letters, digits and common separators only; empty clears it.
    allowed.serialNumber = changes.serialNumber.trim().replace(/[^\w\-./: ]/g, "").slice(0, 64);
  }
  return allowed;
}

export async function updateItem(homeId, roomId, itemId, changes) {
  const room = await getRoom(homeId, roomId);
  const item = room?.items.find((it) => sameId(it._id, itemId));
  if (!item) return null;
  const allowed = cleanItemChanges(item, changes);
  // "Edited" means the owner corrected what the AI said. Adding a serial number doesn't count.
  if ("name" in allowed || "estValue" in allowed) allowed.editedByUser = true;
  if (useMongo) {
    const set = Object.fromEntries(Object.entries(allowed).map(([k, v]) => [`items.$.${k}`, v]));
    return Room.findOneAndUpdate({ _id: roomId, "items._id": itemId }, { $set: set }, { returnDocument: "after" }).lean();
  }
  const stored = memory.rooms.get(roomId);
  Object.assign(stored.items.find((it) => it._id === itemId), allowed);
  return copy(stored);
}

export async function deleteItem(homeId, roomId, itemId) {
  const room = await getRoom(homeId, roomId);
  const item = room?.items.find((it) => sameId(it._id, itemId));
  if (!item) return null;
  let updated;
  if (useMongo) {
    updated = await Room.findByIdAndUpdate(roomId, { $pull: { items: { _id: itemId } } }, { returnDocument: "after" }).lean();
  } else {
    const stored = memory.rooms.get(roomId);
    stored.items = stored.items.filter((it) => it._id !== itemId);
    updated = copy(stored);
  }
  // Remove the item's photo unless another item in the room shares it.
  if (item.photoId && !updated.items.some((it) => sameId(it.photoId, item.photoId))) {
    await deletePhotoById(item.photoId);
  }
  return updated;
}

// ---------- photos ----------

export async function savePhoto({ data, mimeType, roomId, userId }) {
  if (useMongo) return (await Photo.create({ data, mimeType, roomId, userId }))._id;
  const id = newId();
  memory.photos.set(id, { _id: id, data, mimeType, roomId: String(roomId), userId: String(userId) });
  return id;
}

export async function getPhoto(id) {
  if (!validId(id)) return null;
  if (useMongo) {
    const photo = await Photo.findById(id); // not lean(), so `data` comes back as a Buffer
    return photo ? { ...photo.toObject(), data: Buffer.from(photo.data) } : null;
  }
  return memory.photos.get(id) ?? null;
}

async function deletePhotoById(id) {
  if (useMongo) await Photo.deleteOne({ _id: id });
  else memory.photos.delete(String(id));
}

async function deletePhotos({ roomId, exceptIds = [] }) {
  const keep = new Set(exceptIds.map(String));
  if (useMongo) {
    await Photo.deleteMany({ roomId, _id: { $nin: [...keep] } });
    return;
  }
  for (const [id, photo] of memory.photos) {
    if (sameId(photo.roomId, roomId) && !keep.has(id)) memory.photos.delete(id);
  }
}
