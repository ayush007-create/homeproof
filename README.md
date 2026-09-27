# HomeProof

**Film your room once. Be ready for anything.**

HomeProof is a mobile-first web app that turns a quick walk-through recording of each room into an insurance-ready home inventory. Gemini identifies every item worth claiming, estimates its replacement value, and keeps a photo of each item as evidence. When a hurricane, fire or break-in happens, tap **Get your claim report** and download a professional PDF listing everything, grouped by room.

Built at ShellHacks 2026 (FIU).

## Features

- **Homes and rooms.** Several homes per account, named rooms in each, with totals per room and per home (always added up from the items).
- **Verified address.** Every home needs an address, set from the phone's current location or typed and looked up (OpenStreetMap). Each address can be registered once across all users, and no two homes can sit at the same spot (different apartments in one building are fine with a unit number). Once rooms have been recorded, the address is locked.
- **Recorded at home, provably.** Recording only unlocks within 150 m of the home. While recording, the phone keeps checking its location and stops if you leave. The location fixes go to the server with the photos, which checks them again before scanning. Rooms that pass get "Location verified" in the app and the claim report. Only the distance is kept, never where you've been. If location is blocked, the app explains why it's needed and how to allow it.
- **Nearby home.** After login, the homes list shows which home you're at (or the nearest one and how far) and sorts homes by distance. Distances are worked out on the phone.
- **Scan a room.** Record with the camera (up to 2 minutes). The phone snapshots it into up to 30 photos; no video file is made or uploaded. There is no video upload.
- **AI inventory.** All photos go to Gemini in one request. It lists each physical item once, with category, condition, estimated value, a low–high range, and the photo where the item is clearest.
- **Evidence photos.** Only the photos that items point to are saved (in MongoDB), shown with an amber timestamp tag.
- **Add new things later.** Bought something new? Tap **Add items** on a scanned room and film just the new things. Gemini gets the room's current list, skips anything already on it, and the new items are added (marked "New", and "Added <date>" in the app and the claim report). Edits and serial numbers on existing items stay. Room, home and report totals update automatically.
- **Edit anything.** Tap an item to fix its name or value, or delete it. Re-scan a room to replace all its items.
- **Serial numbers.** Electronics and appliances get a serial number box right in their card, so the insurer can check coverage. Serials appear in the claim report.
- **Claim report PDF.** Per home: owner, address, event type and date, a short summary written by Gemini from the item list, items grouped by room with photos, subtotals, grand total, and page numbers.
- **Voice.** ElevenLabs reads a short summary after each scan and when the report is ready (mute in the account menu).
- **Accounts.** Email + password. Sessions last 7 days.
- **Feels like an app.** Installable PWA, phone-first layout, bottom action bars, light and dark mode, skeleton loaders, reduced-motion support.

The AI is part of the flow, not a chatbot. Every value is an estimate, never an appraisal.

## Tech stack

| Part | Tech |
|------|------|
| Frontend | React 19, Vite, React Router, lucide-react icons, MapLibre GL (OpenFreeMap vector maps, no key) |
| Backend | Node.js 20+, Express 5 |
| AI | Google Gemini (`@google/genai`), main model + automatic backup model; optional Anthropic Claude (`@anthropic-ai/sdk`, Claude Haiku 4.5) as the last-resort backup |
| Database | MongoDB Atlas with Mongoose (in-memory fallback when no `MONGODB_URI`) |
| Voice | ElevenLabs text-to-speech (Flash model) |
| Auth | bcrypt + JWT in an httpOnly cookie |
| PDF | pdfkit |

## Run it

You need Node.js 20 or newer.

**1. Backend**

```bash
cd server
npm install
cp .env.example .env      # then fill in JWT_SECRET and GEMINI_API_KEY (and MONGODB_URI)
npm run dev               # http://localhost:3001
```

**2. Frontend** (second terminal)

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

**3. Demo account**

```bash
cd server
npm run seed:demo         # creates or resets demo@homeproof.app / HomeProof2026
```

Without `MONGODB_URI`, the server creates the demo account in memory by itself on every start.

**4. Test on your phone** (the camera needs https)

```bash
cd client
npm run dev:phone
```

Open the `Network: https://192.168.x.x:5173` address on a phone on the same Wi-Fi, accept the certificate warning (it's your own dev server) and allow the camera.

### Handy server scripts

| Command | What it does |
|---------|--------------|
| `npm run models` | Lists the Gemini model names your key can use |
| `npm run compare -- <folder of .jpg>` | Sends the same photos to each configured model and prints time, item count and item names side by side |
| `npm run seed:demo` | Creates or resets the demo account |

Set `MOCK_SCAN=1` to get fake items without calling Gemini (for UI work).

## Environment variables

**`server/.env`**

| Name | Required | Notes |
|------|----------|-------|
| `JWT_SECRET` | yes | The server won't start without it |
| `GEMINI_API_KEY` | yes (unless `MOCK_SCAN=1`) | Google AI Studio key |
| `MONGODB_URI` | recommended | Atlas connection string; without it data is in memory |
| `GEMINI_MODEL` | no | Default `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODELS` | no | Default `gemini-flash-lite-latest` |
| `MODEL_TIMEOUT_MS` | no | Per model, default 20000 |
| `SCAN_TIMEOUT_MS` | no | Whole scan, default 60000 |
| `ANTHROPIC_API_KEY` | no | Enables the Claude backup, used only when every Gemini model fails |
| `ANTHROPIC_MODEL` | no | Default `claude-haiku-4-5` |
| `ELEVENLABS_API_KEY` | no | Enables voice |
| `ELEVENLABS_VOICE_ID` | no | Default: a premade voice |
| `CLIENT_ORIGIN` | production | Frontend URL(s), comma-separated |
| `MOCK_SCAN` | no | `1` = fake items |
| `HOME_RADIUS_M` | no | Recording radius around a home, default 150 |
| `REQUIRE_LOCATION` | no | `0` switches the location check off (local testing only) |
| `GEOCODER_CONTACT` | no | Email/site sent to OpenStreetMap's address lookup |
| `NOMINATIM_URL` | no | Your own Nominatim server |
| `PORT` | no | Default 3001 |

**`client/.env`**

| Name | Required | Notes |
|------|----------|-------|
| `VITE_API_URL` | production only | Backend URL. Leave empty in development |

## How a scan works

1. Recording unlocks only when the phone's location is within the home's radius (150 m plus up to 50 m for the location's error margin; fixes rougher than ±150 m don't count). While recording, the app snapshots the camera every 2 seconds (up to 30 photos, 1024 px, JPEG) and records each location fix; one precise fix outside the radius stops the recording.
2. All photos and the location fixes go to `POST /api/homes/:homeId/rooms/:roomId/scan` in one request. The server rejects the recording before calling Gemini unless every precise fix is at the home and recent. It stores only when the check passed, how many fixes there were, and the farthest distance from home.
3. The server sends them to Gemini in one request, each labelled `Frame N (MM:SS):`, asking for each item once plus the frame where it's clearest.
4. Each model gets 20 s (retries on 429/5xx inside that budget). If the main model fails it switches to the backup and skips the main model for 3 minutes. A model whose daily quota is used up is skipped without retrying; a Gemini account problem (no credit, bad key) skips Gemini for 3 minutes. If every Gemini model fails and `ANTHROPIC_API_KEY` is set, the same photos go to Claude (the last 25 s of the budget are kept for it). The whole scan gives up after 60 s with a friendly error.
5. Only the frames that items point to are saved as photos; the rest are dropped.
6. **Add items** (`?mode=add`) works the same way, but the prompt also lists the items the room already has and asks only for new ones. The server drops any exact name match as a safety net, then appends the new items (with `addedAt`) and keeps every existing item and photo.

## API

All routes except auth and health need the login cookie, and only return the user's own data.

| Route | Purpose |
|-------|---------|
| `POST /api/auth/signup` · `login` · `logout`, `GET /api/auth/me` | Accounts |
| `GET /api/geo/search?q=` · `GET /api/geo/reverse?lat=&lng=&accuracy=` | Address lookup (OpenStreetMap). Each result has a signed `token` |
| `GET/POST /api/homes`, `GET/PATCH/DELETE /api/homes/:homeId` | Homes (with totals). Create/change the address with `{ placeToken, unit }` |
| `POST /api/homes/:homeId/rooms`, `GET/PATCH/DELETE …/rooms/:roomId` | Rooms |
| `POST …/rooms/:roomId/scan` | Scan from photos (`frames`, JSON `times`, JSON `location` fixes), replaces the room's items |
| `POST …/rooms/:roomId/scan?mode=add` | Same format; adds only new items, returns `{ room, addedIds }` |
| `PATCH/DELETE …/rooms/:roomId/items/:itemId` | Edit or delete an item |
| `GET /api/photos/:id` | Item photo (owner only) |
| `GET /api/homes/:homeId/report.pdf?event=&date=` | Claim report PDF |
| `POST /api/speak` | `{ text }` → MP3 (204 when voice is off) |
| `GET /api/config`, `GET /api/health` | Feature flags, health check |

## Deploy (one service on Render)

The server also serves the built app, so the whole thing is **one web service with one https address**: no CORS, no cross-site cookies (logins work on iPhones), and the desktop QR code points straight at it.

1. Push the repo to GitHub.
2. On [render.com](https://render.com): **New → Blueprint**, pick the repo. `render.yaml` sets everything up (build `npm run build`, start `npm start`, health check `/api/health`, free plan, a generated `JWT_SECRET`).
3. Fill in the secret values when asked: `MONGODB_URI`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `GEOCODER_CONTACT` (your email).
4. Deploy. The site is at `https://homeproof.onrender.com` (or the name Render gives it).

Manual setup instead of the Blueprint: Web Service, root = repo root, build `npm run build`, start `npm start`, env vars as above plus `JWT_SECRET`.

- MongoDB Atlas → Network Access: allow `0.0.0.0/0` (Render's addresses change).
- Render's free server sleeps after 15 minutes idle; the first visit then takes about a minute. Open the site a minute before a demo.
- The desktop view's QR code encodes the address the site is open at. When you open it locally, set `VITE_PUBLIC_URL` in `client/.env` to the hosted address so the QR code still points there.
- Camera and location only work on https (Render provides it).
- `client/vercel.json` is kept for a split deploy (Vercel frontend + separate backend), but the single service above is simpler.

## Files

```
server/
  index.js        app setup, routes, startup checks
  auth.js         signup/login/logout, session cookie, requireAuth
  homes.js        homes, rooms, items, photos, scan routes
  gemini.js       prompts, JSON schema, model timeouts/backup, report summary
  geo.js          address lookup, home radius, recording location check
  claude.js       optional Claude backup (used when every Gemini model fails)
  report.js       claim report PDF
  voice.js        ElevenLabs text-to-speech
  store.js        Mongoose models + in-memory fallback
  demo.js         demo data; seed-demo.js runs it
  placeholder.js  draws placeholder photos for the demo
  compare.js      compares Gemini models on the same photos
  list-models.js  lists Gemini models
client/src/
  App.jsx         routes and layout
  auth.jsx        login state, protected routes
  api.js          backend calls
  frames.js       turns the camera into photos
  location.js     watches the phone's location, "am I at this home?"
  voice.js        voice playback and mute
  Results.jsx     room results: reveal, photos, edit, delete
  pages/          Login, Homes, Home, RoomNew, Room, Report
  components/     Camera, ScanFlow, TopBar, Sheet, illustrations, …
```
