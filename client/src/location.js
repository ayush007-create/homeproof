import { useEffect, useRef, useState } from "react";

// Location checks: recording only unlocks at the home, and the location fixes
// taken while recording are sent with the photos so the server can verify them.
// The same rules live in server/geo.js; the server has the final say.

let settings = { required: true, radiusM: 150, maxAccuracyM: 150 };
export const setLocationSettings = (s) => s && (settings = { ...settings, ...s });
export const locationRequired = () => settings.required;

const ACCURACY_ALLOWANCE_M = 50;

export const PERMISSION_MESSAGE =
  "HomeProof needs your location once per scan to prove the video was recorded at your home. We don't store where you go.";

export function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// A browser position → the small fix we work with (and send to the server).
export const toFix = (pos) => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  acc: pos.coords.accuracy,
  t: pos.timestamp || Date.now(),
});

export const isPrecise = (fix) => fix.acc <= settings.maxAccuracyM;

// Is this fix at the home? Uses the fix's error margin, capped, like the server.
export function atHome(fix, home) {
  if (!home?.location) return false;
  const radius = home.radiusM || settings.radiusM;
  return distanceM(fix, home.location) <= radius + Math.min(fix.acc, ACCURACY_ALLOWANCE_M);
}

// "450 ft" / "2.3 mi" in the US, "140 m" / "3.7 km" elsewhere.
export function formatDistance(m) {
  const us = (navigator.language || "en-US") === "en-US";
  if (us) {
    const ft = m * 3.28084;
    return ft < 1000 ? `${Math.round(ft / 10) * 10} ft` : `${(m / 1609.34).toFixed(m < 16093 ? 1 : 0)} mi`;
  }
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

// Error margin in the same units, e.g. "±40 ft".
export const formatAccuracy = (m) => `±${formatDistance(Math.max(m, 3))}`;

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 };

// One position (for "Use my current location" and the Homes list).
export function getPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Object.assign(new Error("unsupported"), { code: "unsupported" }));
    navigator.geolocation.getCurrentPosition((pos) => resolve(toFix(pos)), reject, { ...GEO_OPTIONS, ...options });
  });
}

// Has the user already blocked location for this site? (Doesn't ask.)
export async function locationBlocked() {
  try {
    return (await navigator.permissions?.query({ name: "geolocation" }))?.state === "denied";
  } catch {
    return false;
  }
}

// Watches the position while `enabled` and says whether the user is at `home`.
// status: off (check switched off) | no-address | unsupported | checking |
//         denied | imprecise | outside | inside | error
// onFix(fix, inside) is called for every new fix (used while recording).
export function useHomeLocation(home, { enabled = true, onFix } = {}) {
  const [state, setState] = useState({ status: "checking", fix: null, distance: null });
  const [attempt, setAttempt] = useState(0);
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  const off = !settings.required;
  const noAddress = !off && !home?.location;

  useEffect(() => {
    if (off || noAddress || !enabled) return;
    if (!navigator.geolocation) return setState({ status: "unsupported", fix: null, distance: null });
    setState((s) => ({ ...s, status: s.fix ? s.status : "checking" }));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = toFix(pos);
        const inside = isPrecise(fix) && atHome(fix, home);
        setState({
          status: !isPrecise(fix) ? "imprecise" : inside ? "inside" : "outside",
          fix,
          distance: distanceM(fix, home.location),
        });
        onFixRef.current?.(fix, inside);
      },
      (err) =>
        setState((s) => ({
          ...s,
          status: err.code === 1 ? "denied" : s.fix ? s.status : "error", // 1 = PERMISSION_DENIED
        })),
      GEO_OPTIONS
    );
    return () => navigator.geolocation.clearWatch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off, noAddress, enabled, attempt, home?.location?.lat, home?.location?.lng]);

  const status = off ? "off" : noAddress ? "no-address" : state.status;
  return { ...state, status, canRecord: status === "off" || status === "inside", retry: () => setAttempt((n) => n + 1) };
}
