import express from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "./auth.js";

// Home locations: turning addresses into coordinates (and back), and checking
// that a recording was made at the home.
//
// Geocoding uses OpenStreetMap's Nominatim (free, no key). Its rules: at most
// one request per second and an identifying User-Agent, so requests are queued
// and cached here. https://operations.osmfoundation.org/policies/nominatim/

// Recording unlocks within this distance of the home's coordinates. 150 m covers
// a house with its yard or a large apartment building, plus the usual error of
// phone GPS indoors (5–50 m) and of an address lookup (10–50 m).
export const HOME_RADIUS_M = Number(process.env.HOME_RADIUS_M) || 150;
// Fixes rougher than this can't tell whether someone is home (iPhone "Precise
// Location" off reports ±1–3 km).
export const MAX_ACCURACY_M = 150;
// A fix counts as inside if the home is within its error margin, capped here so
// a rough fix can't stretch the radius much.
const ACCURACY_ALLOWANCE_M = 50;
// Two homes closer than this are the same place (unless they are different apartments).
const SAME_SPOT_M = 15;

export const locationRequired = () => process.env.REQUIRE_LOCATION !== "0";

// ---------- distance ----------

export function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const insideHome = (fix, home) =>
  distanceM(fix, home.location) <= (home.radiusM || HOME_RADIUS_M) + Math.min(fix.acc, ACCURACY_ALLOWANCE_M);

// Bounding box around a point, for a cheap database pre-filter before measuring distance.
export function boxAround({ lat, lng }, meters = SAME_SPOT_M) {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

// "4B" → "4b", "Apt #4B" → "4b". Two homes at one spot are fine if their units differ.
export const unitKey = (unit) => String(unit || "").toLowerCase().replace(/\b(apt|apartment|unit|suite|ste|flat|no)\b\.?/g, "").replace(/[^a-z0-9]/g, "");

// "4B" → "Unit 4B"; "Apt 4B" stays as typed.
export function unitLabel(unit) {
  const u = String(unit || "").trim().slice(0, 30);
  if (!u) return "";
  return /^#?[\w-]+$/.test(u) && /\d/.test(u) ? `Unit ${u.replace(/^#/, "")}` : u;
}

export function sameSpot(a, b) {
  if (distanceM(a.location, b.location) > SAME_SPOT_M) return false;
  // Different apartments in one building share coordinates.
  const ua = a.unitKey || "", ub = b.unitKey || "";
  return !(ua && ub && ua !== ub);
}

// ---------- Nominatim ----------

const NOMINATIM = (process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
const USER_AGENT = `HomeProof/1.0 (home inventory app${process.env.GEOCODER_CONTACT ? `; ${process.env.GEOCODER_CONTACT}` : ""})`;
const cache = new Map();
let nextSlot = 0;

async function nominatim(path, params) {
  const url = `${NOMINATIM}${path}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params })}`;
  if (cache.has(url)) return cache.get(url);
  // One request per second, in order.
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);
  const data = await res.json();
  cache.set(url, data);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return data;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// A Nominatim result → { address, lat, lng, precise, key }.
// precise: the lookup found the building (house number), not just the street.
// key: identifies the address regardless of how it was typed ("SW 8th St" and
// "Southwest 8th Street" come back from Nominatim as the same road).
function toPlace(r) {
  const a = r.address || {};
  const road = a.road || a.pedestrian || a.footway || a.residential;
  const street = [a.house_number, road].filter(Boolean).join(" ") || r.name || "";
  const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county;
  const state = a["ISO3166-2-lvl4"]?.split("-")[1];
  const region = [state, a.postcode].filter(Boolean).join(" ");
  const country = a.country_code === "us" ? null : a.country;
  const precise = Boolean(a.house_number && road);
  return {
    address: [street, city, region, country].filter(Boolean).join(", ").slice(0, 200),
    lat: Number(r.lat),
    lng: Number(r.lon),
    precise,
    key: precise ? [a.house_number, road, a.postcode || city, a.country_code].map(norm).join("|") : null,
  };
}

// ---------- place tokens ----------

// A lookup result is signed so that when the home is saved, the server can
// trust its coordinates without looking it up again (and without trusting
// coordinates sent by the browser for a typed address).
const signPlace = (place, source) => jwt.sign({ place, source }, process.env.JWT_SECRET, { expiresIn: "1h" });

export function readPlaceToken(token) {
  try {
    const { place, source } = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return { ...place, source };
  } catch {
    return null;
  }
}

// ---------- routes ----------

export const geoRouter = express.Router();
geoRouter.use(requireAuth);

const lookupFailed = (res) =>
  res.status(502).json({ error: "Address lookup isn't working right now. Please try again in a minute." });

// Typed address → up to 4 matches. Only building-level matches can be chosen.
geoRouter.get("/geo/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 200);
  if (q.length < 5) return res.status(400).json({ error: "Type the street, city and ZIP code.", field: "address" });
  try {
    const seen = new Set();
    const results = (await nominatim("/search", { q, limit: "5" }))
      .map(toPlace)
      .filter((p) => p.address && !seen.has(p.address) && seen.add(p.address))
      .slice(0, 4)
      .map((p) => ({ address: p.address, lat: p.lat, lng: p.lng, precise: p.precise, token: p.precise ? signPlace(p, "address") : null }));
    res.json({ results });
  } catch (err) {
    console.warn("Address search failed:", err.message);
    lookupFailed(res);
  }
});

// Current location → address. The home keeps the phone's own coordinates.
geoRouter.get("/geo/reverse", async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng), acc = Number(req.query.accuracy);
  if (!validCoords(lat, lng)) return res.status(400).json({ error: "That location doesn't look right." });
  if (!(acc <= MAX_ACCURACY_M)) {
    return res.status(400).json({ error: preciseLocationHelp(acc) });
  }
  try {
    const found = await nominatim("/reverse", { lat: String(lat), lon: String(lng), zoom: "18" });
    if (found.error) return res.status(404).json({ error: "We couldn't find an address here. Type your address instead." });
    const place = { ...toPlace(found), lat, lng };
    res.json({ result: { address: place.address, lat, lng, accuracy: Math.round(acc), precise: place.precise, token: signPlace(place, "gps") } });
  } catch (err) {
    console.warn("Reverse lookup failed:", err.message);
    lookupFailed(res);
  }
});

const validCoords = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const preciseLocationHelp = (acc) =>
  `Your location is too rough${Number.isFinite(acc) ? ` (within ${Math.round(acc)} m)` : ""} to pin your home. ` +
  "Turn on Precise Location and Wi-Fi, then try again, or type your address.";

// ---------- checking a recording ----------

// The phone sends the location fixes it took while recording:
// [{ lat, lng, acc, t }] (acc = error margin in meters, t = time in ms).
// Every usable fix must be at the home. Returns what the room stores as proof
// (no coordinates are kept: only how far from home the farthest fix was).
export function checkRecordingLocation(home, raw) {
  if (!locationRequired()) return { ok: true, proof: null };
  if (!home.location) {
    return { ok: false, status: 409, code: "no_address", error: "Add this home's address before recording." };
  }
  let fixes;
  try {
    fixes = JSON.parse(raw || "[]");
  } catch {
    fixes = [];
  }
  const now = Date.now();
  fixes = (Array.isArray(fixes) ? fixes.slice(0, 500) : [])
    .map((f) => ({ lat: Number(f?.lat), lng: Number(f?.lng), acc: Number(f?.acc), t: Number(f?.t) }))
    .filter((f) => validCoords(f.lat, f.lng) && f.acc >= 0 && f.t > now - 20 * 60_000 && f.t < now + 5 * 60_000);
  const usable = fixes.filter((f) => f.acc <= MAX_ACCURACY_M);
  if (!usable.length) {
    return { ok: false, status: 403, code: "no_location", error: "We couldn't confirm where this was recorded. Allow location and try again." };
  }
  if (usable.some((f) => !insideHome(f, home))) {
    return {
      ok: false,
      status: 403,
      code: "outside",
      error: `This wasn't recorded at ${home.name}. Recordings only count when you're at home.`,
    };
  }
  return {
    ok: true,
    proof: {
      verifiedAt: new Date(),
      fixes: usable.length,
      maxDistanceM: Math.round(Math.max(...usable.map((f) => distanceM(f, home.location)))),
    },
  };
}
