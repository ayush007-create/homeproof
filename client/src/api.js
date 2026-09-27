// In development, Vite forwards /api to the Express server.
// In production, set VITE_API_URL to the backend URL (e.g. https://homeproof-api.onrender.com).
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field; // which form field the error belongs to, if any
  }
}

// Called when the session has expired, so the app can send the user to /login.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function readError(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  return new ApiError(body.error || `Something went wrong (${res.status}).`, res.status, body.field);
}

async function request(path, { method = "GET", body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method,
      credentials: "include", // send the login cookie
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach HomeProof. Check your connection and try again.", 0);
  }
  if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized();
  if (!res.ok) throw await readError(res);
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

export const photoUrl = (id) => (id ? `${API}/api/photos/${id}` : null);

export const api = {
  config: () => request("/config"),

  me: () => request("/auth/me"),
  signup: (data) => request("/auth/signup", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),
  logout: () => request("/auth/logout", { method: "POST" }),

  // Address lookups. Each result carries a signed token that createHome/updateHome accept.
  searchAddress: (q) => request(`/geo/search?${new URLSearchParams({ q })}`),
  reverseGeocode: ({ lat, lng, acc }) => request(`/geo/reverse?${new URLSearchParams({ lat, lng, accuracy: acc })}`),

  homes: () => request("/homes"),
  createHome: (data) => request("/homes", { method: "POST", body: data }),
  home: (homeId) => request(`/homes/${homeId}`),
  updateHome: (homeId, data) => request(`/homes/${homeId}`, { method: "PATCH", body: data }),
  deleteHome: (homeId) => request(`/homes/${homeId}`, { method: "DELETE" }),

  createRoom: (homeId, data) => request(`/homes/${homeId}/rooms`, { method: "POST", body: data }),
  room: (homeId, roomId) => request(`/homes/${homeId}/rooms/${roomId}`),
  updateRoom: (homeId, roomId, data) => request(`/homes/${homeId}/rooms/${roomId}`, { method: "PATCH", body: data }),
  deleteRoom: (homeId, roomId) => request(`/homes/${homeId}/rooms/${roomId}`, { method: "DELETE" }),

  updateItem: (homeId, roomId, itemId, data) =>
    request(`/homes/${homeId}/rooms/${roomId}/items/${itemId}`, { method: "PATCH", body: data }),
  deleteItem: (homeId, roomId, itemId) =>
    request(`/homes/${homeId}/rooms/${roomId}/items/${itemId}`, { method: "DELETE" }),

  // Returns { blob, reportId, pages } for the claim report PDF.
  async report(homeId, { event, date }) {
    const query = new URLSearchParams({ event, ...(date ? { date } : {}) });
    const res = await request(`/homes/${homeId}/report.pdf?${query}`, { raw: true });
    const blob = await res.blob();
    // Count pages by their "/Type /Page" entries (not "/Pages").
    const pages = ((await blob.text()).match(/\/Type\s*\/Page(?!s)/g) || []).length || null;
    return { blob, reportId: res.headers.get("X-Report-Id"), pages };
  },

  // Returns MP3 audio as a Blob, or null when voice is off.
  async speak(text) {
    const res = await request("/speak", { method: "POST", body: { text }, raw: true });
    return res.status === 204 ? null : res.blob();
  },
};

// Sends all photos of a room in one request. Resolves { room, addedIds }.
// mode "add": the photos show new things, which are added to the room's items
// (addedIds lists them) instead of replacing them.
// location: the location fixes taken while recording (the server checks they're at the home).
// Uses XMLHttpRequest instead of fetch because fetch cannot report upload progress.
export function scanRoom(homeId, roomId, frames, { mode = "scan", location = [], onProgress, onUploaded } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    frames.forEach((f, i) => form.append("frames", f.blob, `frame-${i + 1}.jpg`));
    form.append("times", JSON.stringify(frames.map((f) => Math.round(f.time * 10) / 10)));
    form.append("location", JSON.stringify(location));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/homes/${homeId}/rooms/${roomId}/scan${mode === "add" ? "?mode=add" : ""}`);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.upload.onload = () => onUploaded?.();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ room: xhr.response.room, addedIds: xhr.response.addedIds ?? [] });
      if (xhr.status === 401) onUnauthorized();
      reject(new ApiError(xhr.response?.error || `The scan failed (${xhr.status}).`, xhr.status, xhr.response?.code));
    };
    xhr.onerror = () => reject(new ApiError("Can't reach HomeProof. Check your connection and try again.", 0));
    xhr.send(form);
  });
}
