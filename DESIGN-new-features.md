# HomeProof — New Features Design Brief

This brief covers the features added to HomeProof **after** the "Liquid Glass" UI proposal (`HomeProof Screens Liquid Glass.dc.html`). Those screens are built and are the visual base. This document describes what is new, how each feature works today, every screen state with its exact wording, and where design help is wanted. The last section says what to send back.

Use it together with the Liquid Glass file: keep that visual language and design the new screens and states described here.

---

## 1. What's new, in one list

1. **Verified home address.** Adding a home now needs an address, set from the phone's current location or typed and looked up. The confirmed address is shown on a map with the area where recording works.
2. **Each address once.** No two homes (across all users) can have the same address or sit at the same spot. Different apartments in one building are allowed with a unit number.
3. **Recording only at home.** The Record button only works within 150 m (about 490 ft) of the home. While recording, the phone keeps checking its location and stops if the user leaves.
4. **Location permission popup.** If location is blocked, a sheet explains why HomeProof needs it and how to allow it.
5. **"Location verified" proof.** Rooms recorded at home show a verified line in the app and in the claim report PDF.
6. **Nearby home after login.** The homes list shows which home the user is at, or the nearest one and how far away it is, and sorts homes by distance.
7. **Add items.** On a scanned room, the user can film just the new things they bought. The new items are added to the list (nothing is replaced).
8. **Serial numbers.** Electronics and appliances get a serial number box in their item card. Serials appear in the claim report.
9. **Summary button.** A button on the room page reads a short spoken summary (ElevenLabs voice).
10. **Stop recording anytime.** The old 10-second minimum is gone.
11. **Video upload removed.** Rooms can only be recorded live in the app (so recordings can be verified). There is no "Upload a video" button any more.

---

## 2. Rules that still apply

Everything in the original brief still holds: phone first (360 / 390 / 430 px), main action in the floating bottom bar, 44 px tap targets, 16 px body text, light and dark mode, lucide icons only, no chatbot, values are estimates, confirmations in bottom sheets, errors inline under fields.

New rules from these features:

- **Privacy promise:** "We don't store where you go." The app never keeps a trail of locations. The server keeps only the home's address and, per room, that the check passed and how far from home the farthest reading was. Designs must not show a location history or a map of where the user walked.
- **The recording is the proof.** Anything that makes it look like location can be skipped or faked (e.g. a "record anyway" button) is out.
- **Distances in the user's units:** feet and miles in the US ("490 ft", "1.1 mi"), metres and kilometres elsewhere.
- **Plain, calm wording** for blocked states. The user is often not doing anything wrong (e.g. they're simply not home yet).

---

## 3. Tokens used by the new features

All existing Liquid Glass tokens apply (teal accent `#0e6a87`, amber tag `#e3a33a`, glass surfaces, Google Sans / DM Sans / Nunito).

One colour was added for "at home / verified":

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ok` | `#1f7a4d` | `#6fd49b` | "You're here", "Location verified", ring around the at-home card |
| `--ok-soft` | `#dcf1e5` | `rgba(111,212,155,.16)` | Icon tile background for the at-home state |

Amber (`--tag`, `--tag-soft`, `--tag-soft-ink`) is used for "not yet / needs attention" states: away from home, location blocked, rough location, address needed, and for "New" item marks.

New icons in use: `locate-fixed`, `locate-off`, `map-pin`, `map-pin-check`, `map-pin-off`, `navigation`, `search`, `refresh-cw`, `package-plus`, `search-x`, `plus`, `focus`, `list-checks`, `scan-barcode`, `volume-2`, `square`, `shield-check`.

---

## 4. Features in detail

### 4.1 Adding a home with a verified address

**Where:** "Add a home" bottom sheet on `/homes`, and the same picker in "Add address / Change address" on `/homes/:homeId`.

**Goal:** pin the home's exact location with as little typing as possible, so recordings can later be checked against it.

**Sheet layout, top to bottom:**
1. **Name** field (placeholder "Miami Apartment").
2. **Address** section, one of two states:

**State A: no address chosen yet**
- Full-width secondary button: `locate-fixed` icon + **"Use my current location"**. While working: spinner + "Finding your home…".
- Divider with centred text **"or type it"**.
- Search row: text input (placeholder "Street, city, ZIP") and a square search button (`search` icon). Enter also searches.
- Results list (up to 4), each a tappable row with a `map-pin` icon and the address, for example "1500 Bay Road, Miami Beach, FL 33139".
  - A match that found only the street (no house number) is shown **disabled** with a small note: "Only the street was found. Add the house number, or use your current location."
- Errors inline under the section:
  - "Type the street, city and ZIP code."
  - "We couldn't find that address. Check the street, city and ZIP, or use your current location."
  - "Location is blocked for this site. Allow it in your browser settings, or type your address."
  - "Your location is too rough (±1.6 mi) to pin your home. Turn on Precise Location and Wi-Fi, or type your address."
  - "Couldn't get your location. Try again, or type your address."

**State B: address chosen (the place card)**
- A card with a **map** on top (about 196 px tall) and an address row below.
- The map (built with MapLibre and OpenFreeMap vector tiles, recoloured to the app palette, light and dark):
  - A **teal pin** (accent circle with a white `house` icon, white border, small point, soft pulse under it).
  - A **dashed teal circle** showing the recording zone (150 m), lightly filled.
  - A frosted glass chip at bottom-left: dashed dot + **"Recording zone · 490 ft"**.
  - The map-data credit as a small ⓘ button at bottom-right.
  - Not interactive (it's a picture of the spot, so the sheet scrolls normally over it).
  - While loading: a shimmer. If maps can't load: a plain pin with the coordinates.
- Address row: `map-pin` tile, the address in bold ("28 North Miami Avenue, Miami, FL 33128"), and a sub-line saying where it came from: **"From your current location · ±40 ft"** or **"Found from the address you typed"**. A **"Change"** button on the right returns to State A.
- Hint under the card: "Check the pin is on your home. You can only record when you're within 490 ft of it."
3. **Apt, suite or unit** field, optional (placeholder "Apt 2104"). Shown in both states. It's added to the address after the street: "1500 Bay Road, Unit 12A, Miami Beach, FL 33139".
4. **Save home** button (full width, primary).

**Errors on save** (shown under the address section):
- No address yet: "Add the address: use your current location or search for it."
- Same user, same home: `You've already added this home ("Miami Apartment").`
- Another user has this address: "This address is already registered on HomeProof. Each home can only be added once."
- Another home within 15 m (and no different unit numbers): "Another home is already registered at this exact spot. If you live in an apartment, add your apartment or unit number."

**Address lock:** once any room in the home has been recorded, the address can't be changed ("Change address" disappears from the home's ⋮ menu). If an old request tries: "The address can't be changed after rooms have been recorded here, because those recordings were verified at this address."

**Homes added before this feature** have no location. The home page shows an amber card at the top:
- Title "Add this home's address", text "Recording only works at the home, so HomeProof needs to know where it is.", button **Add** (opens the address sheet, titled "Add address", which also shows the old saved text: "Saved before: …").

**Design questions:**
- The sheet is tall once the map shows (name + map card + hint + unit + button). Is there a better order or a more compact place card at 360 px?
- Should "Use my current location" be more prominent than typing, since it's more accurate?
- How should the map look in dark mode so the teal circle still reads clearly?

---

### 4.2 Nearby home on My Homes (after login)

**Where:** `/homes`, between the "Everything you own" card and the home list.

**How it works:** the phone's location is read once (the browser asks the first time). Distances are worked out on the phone; the location is not sent anywhere.

**States:**
| State | What shows |
|---|---|
| At one of their homes | Card with green ring: `map-pin-check` tile, **"You're at Miami Apartment"**, "Recording is unlocked here.", chevron. Tapping opens the home. |
| Not at any home | Card: `navigation` tile, **"Nearest home: Miami Apartment"**, "1.1 mi away · recording unlocks when you're there", chevron. |
| Location blocked | Small muted line: "Turn on location to see which home you're at." |
| Still finding / no homes with an address | Nothing extra. |

**Home cards** gain a chip at the right of their footer:
- Green `map-pin-check` **"You're here"**
- Muted **"1.1 mi away"**
- Amber **"Address needed"** (home has no location yet)

With a location, homes are **sorted nearest first**.

**Design question:** does the nearby card compete with the "Everything you own" total? Would it work better above it, or merged into the top of the list?

---

### 4.3 Recording only at home

**Where:** the recording screens: "Add a room" (`/homes/:homeId/rooms/new`), "Scan this room", "Re-scan" and "Add items" on `/homes/:homeId/rooms/:roomId`.

**Layout of the pre-recording screen:** page title, (room name field for a new room), "How to film a room" guide card, trust line ("Up to 2 minutes per room. Your video is never uploaded, only a few photos."), then the **location card**, then a single full-width **Record** button in the bottom bar. (The Upload button is gone.)

**Location card states** (the card updates live as the user moves):

| Status | Icon tile | Title | Sub-line | Action | Record button |
|---|---|---|---|---|---|
| Checking | teal spinner | "Checking you're at Miami Apartment…" | "Recording unlocks at home." | – | off |
| At home | green `map-pin-check`, green ring on card | "You're at Miami Apartment" | "Location verified · ±40 ft" | – | **on** |
| Away | amber `map-pin-off` | "You're 1.1 mi from Miami Apartment" | "Recording unlocks when you're at home." | – | off |
| Rough location | amber `locate-off` | "Your location is too rough (±1.6 mi)" | "Turn on Precise Location and Wi-Fi, then try again." | "Try again" | off |
| Blocked | amber `locate-off` | "Location is off for HomeProof" | "It's needed to prove the video was recorded at your home." | "Allow" (opens the popup) | tappable, opens the popup |
| Home has no address | amber `map-pin` | "Add this home's address first" | "Recording unlocks only at the home's address." | "Add" (goes to the home) | off |
| Browser can't share location | amber `locate-off` | "This browser can't share your location" | "Open HomeProof in Safari or Chrome to record." | – | off |
| Other error | amber `locate-off` | "Couldn't get your location" | "Check that location is on, then try again." | "Try again" | off |

**Rules behind the states** (for accurate designs):
- Inside = within 150 m of the home, plus up to 50 m for the reading's own error margin.
- A reading rougher than ±150 m doesn't count (iPhones with "Precise Location" off report ±1–3 km).

**Location permission popup** (bottom sheet, opens automatically when location is blocked, and from "Allow"):
- `map-pin` tile + title **"Allow location"**
- Body, exactly: **"HomeProof needs your location once per scan to prove the video was recorded at your home. We don't store where you go."**
- "How to allow it" with three short lines:
  - **iPhone (Safari):** tap **aA** in the address bar → Website Settings → Location → Allow.
  - **Android (Chrome):** tap the icon left of the address → Permissions → Location → Allow.
  - **Laptop:** click the icon left of the address → Location → Allow.
- Buttons: **"Not now"** (secondary) and **"Try again"** (primary, `refresh-cw`).

**Camera (full screen):**
- Before starting, if the user isn't home, the shutter is disabled and the hint says "Go back to Miami Apartment to record."
- While recording, under the hint "Tap stop whenever you're done", a small light-green line: `map-pin-check` **"At Miami Apartment · location verified"**.
- **Stop works from the first second** (no minimum). In the last 15 seconds of the 2-minute limit the hint becomes "N seconds left".
- **Leaving the home while recording stops it immediately** and discards the photos. The camera closes and the pre-recording screen shows, inline:
  - "Recording stopped: you left Miami Apartment. Recordings only count when you're at home."
  - or "Recording stopped because location was turned off."
- Stopping before a single photo was taken: "That was too quick to take a photo. Record for a few seconds."

**Server double-check** (shown on the "That scan didn't work" error screen if it happens):
- "This wasn't recorded at Miami Apartment. Recordings only count when you're at home."
- "We couldn't confirm where this was recorded. Allow location and try again."
- "Add this home's address before recording."

**Design questions:**
- The location card sits between the guide and the Record button. Would it be clearer inside the bottom bar, right above Record, or as a status strip at the top?
- Is a disabled Record button plus the card enough to explain *why* it's off? Would a small lock icon on the button help?
- Should the camera show an at-home indicator all the time (e.g. a green dot in the top pill), not just a text line?

---

### 4.4 "Location verified" proof

- **Room page:** under the room title, a green line with `shield-check`: **"Recorded at Miami Apartment · location verified"**. It shows only if the room's latest recording passed the check (old or seeded rooms don't have it).
- **Claim report PDF:** each room header reads "7 items · Location verified Sep 27, 2026" on the right.

**Design question:** is a text line enough, or should verification be a stronger badge (on the room card on the home page, and on the report cover)?

---

### 4.5 Add items (new things in a scanned room)

**Where:** `/homes/:homeId/rooms/:roomId`, for rooms that already have items.

**Entry points:**
- The bottom bar now has three buttons: **Re-scan** (icon only on phones ≤420 px: `rotate-ccw`), **+ Add items** (secondary; reads "+ Add" below 340 px), **✓ Done** (primary).
- The ⋮ menu: Rename room · **Add new items** · Re-scan room · Delete room.

**Flow:**
1. **Guide screen:** eyebrow "ADD NEW ITEMS", room name as title. Card **"How to add new things"** · "10–30 SEC":
   - `package-plus` "Film only what's new since your last scan."
   - `focus` "Get close and hold each item in view for a second."
   - `list-checks` (amber) "Things already on your list are skipped, and your edits and serial numbers stay."
   - Then the trust line, the location card and **Record**, as in 4.3.
2. **Scanning screen:** title **"Finding new things…"**, steps "Picking the best shots" → "Sending photos" → **"Checking what's new"**, note "Gemini is comparing these photos with your list and pricing anything new. Usually 10–20 seconds."
3. **Back on the room page** (the list is not replayed item by item):
   - Banner card under the title: `package-plus` tile, **"2 new items added"**, "+$165 to this room. Marked "New" below.", and a dismiss ✕.
   - The new items get an amber **NEW** chip and an amber ring around their card.
   - The room total, item count and date update; the home total and report update too.
   - Voice (if on): "I added 2 new items worth about $165. Kitchen is now worth about $1,675."
   - If nothing new was found: amber `search-x` tile, **"No new items found"**, "Everything in that clip is already on your list." Voice: "I didn't find anything new. Everything in that clip is already on your list."
4. **Later visits:** the NEW chip becomes a muted **"ADDED SEP 27"** chip. In the PDF the item line reads "Decor · New · Added Sep 27, 2026".

**Re-scan confirmation** (now points to Add items): "Re-scan this room?" · "The new scan will replace the 7 items in Kitchen, including any edits and serial numbers you added. To keep them and film only new things, use Add items instead." · Buttons: Cancel / **Replace items**.

**Design questions:**
- Three buttons in the bar is tight at 360 px. Is there a better split (e.g. Add items as the primary action once a room is done)?
- Should the "New" marks and banner fade after a while?

---

### 4.6 Serial numbers

**Where:** inside item cards on the room page (the hero "Most valuable" card and the list rows).

- Shown for items Gemini marks as carrying a manufacturer serial (laptops, phones, tablets, TVs, consoles, cameras, smartwatches, major appliances). Not for bottles, furniture, clothing, cables and so on. A card that already has a serial always keeps its box.
- Row under the item: `scan-barcode` icon + label **"Serial no."**, an input (placeholder **"Add for your insurer"**, monospace-looking digits), and a status spot on the right (spinner while saving, green check when saved).
- Saves when the field loses focus or on Enter. Focused and empty shows a hint: "Usually on a sticker on the back or bottom, or in Settings → About." A failed save: "Couldn't save. Tap the box and try again."
- Adding a serial doesn't mark the item as "Edited".
- In the PDF: "Serial no. 0B7K3CNT402815" (serial in a monospace bold) under the item's category line.

---

### 4.7 Summary button (voice)

- Pill button at the right of the room title: `volume-2` **"Summary"** → spinner **"Loading…"** → `square` **"Stop"** while playing.
- It reads, for example: "I found 7 items worth about $3,500. Your most valuable item is your 3-seat fabric sofa, around $1,100."
- Notes under the title if it can't play: "Voice isn't set up yet." / "Couldn't play the summary. Try again."
- Footer shows "Voice by ElevenLabs" when voice is on.

---

### 4.8 Removed

- **Upload a video** (button, file picker, and the "Picking the best shots" extraction from a file). Rooms are recorded live only.
- The **10-second minimum** recording and the "Keep going… at least 10 seconds" hint.

---

## 5. Screens and states to design

Light and dark for each, at 390 px (check 360 px for the tight ones marked ✱).

| # | Screen | States |
|---|---|---|
| N1 | My Homes | at a home · away (nearest home) · location blocked note · home card chips (here / distance / address needed) |
| N2 | Add a home sheet ✱ | empty (location button + search) · finding location · search results with a street-only match · place card with map · duplicate address error · same-spot error |
| N3 | Home | "Add this home's address" card · ⋮ menu with and without "Change address" |
| N4 | Add address sheet | old home ("Saved before: …") with the picker |
| N5 | Pre-recording (new room / scan / re-scan / add items) ✱ | checking · at home · away · rough · blocked · no address |
| N6 | Location permission popup | – |
| N7 | Camera | away (shutter off) · recording at home · "N seconds left" |
| N8 | Recording stopped | left home · location turned off |
| N9 | Scanning | full scan · add items ("Finding new things…") |
| N10 | Room page ✱ | verified line · Summary button states · three-button bar · serial boxes (empty, focused with hint, saved) |
| N11 | After Add items | "2 new items added" banner + NEW chips · "No new items found" · later visit with "ADDED" chips |
| N12 | Re-scan confirmation | with the Add items hint |
| N13 | Claim report preview | room header with "Location verified", item with serial, item with "Added" date |

---

## 6. Where design help is most welcome

1. **The location card:** make the at-home / away / blocked states instantly readable, and make the path from "blocked" to "fixed" obvious.
2. **The map card** in the Add home sheet: compact at 360 px, beautiful in both themes, clear recording zone.
3. **Room page bottom bar** with three actions.
4. **Verification as a trust signal:** a consistent "verified at home" mark that works on the room page, the home page and the report.
5. **Nearby home card:** friendly, not alarming when the user is away.

---

## 7. What to send back

- Updated screens for the table in section 5 (HTML like the Liquid Glass file is ideal), light and dark.
- Any new or changed tokens (colours, radii, shadows) with light and dark values.
- For each changed component, its states (default, pressed, disabled, loading, error).
- Keep the exact wording above unless you're deliberately improving it; mark changed copy so it can be updated in the code.
