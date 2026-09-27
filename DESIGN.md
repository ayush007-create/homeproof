# HomeProof — Current UI Design

This document describes the HomeProof app's UI **as it is built today**, so a designer can propose improvements. It covers the product, the rules the design must keep, the design tokens, every component, and every screen with its states. The last section says what to send back so the changes can be implemented.

---

## 1. The product in one minute

HomeProof is a **mobile-first web app** for home insurance evidence. A person films each room of their home. AI (Google Gemini) identifies every item worth claiming, estimates its replacement value, and keeps a photo of each item. Users can have several homes, each with named rooms, and see totals per room and per home. After a hurricane, fire or break-in they tap **"Get your claim report"** and download a PDF listing everything.

- **Tagline:** "Film your room once. Be ready for anything."
- **Users:** homeowners and renters, often stressed after a disaster. Mostly on phones.
- **Context:** built at ShellHacks 2026 (hackathon). Judged on a phone and on a laptop projected on a screen.
- **Desired feel:** trustworthy and calm, like a good banking or insurance app, and polished like a native app. It should not look like a template.

---

## 2. Rules the design must keep

These come from the product brief and are not open to change.

**Product rules**
- The name is **HomeProof** everywhere.
- **No chat window or chatbot anywhere.** The AI is part of the flow (scanning, summaries), never a conversation.
- Every value is an **estimate**. Show ranges (low–high) and keep items editable. Never use the words "certified", "appraised" or "appraisal", except in the disclaimer "Not a certified appraisal."
- Users' videos are never uploaded; only item photos are stored. It's a trust message worth showing.
- Confirmations (delete, re-scan) happen **on the page** (bottom sheets), never in browser pop-ups.
- Form errors appear **inline under the field**, never as pop-ups.

**Phone-first rules**
- Design for phone widths first: **360, 390 and 430 px**. On a laptop, the same phone-width column (max 480 px) is centred on a background.
- Installable PWA: app name "HomeProof", icon, theme colour, standalone display.
- Respect safe areas (notch, home bar).
- The **main action of each screen sits in a sticky bottom bar** within thumb reach.
- Tap targets at least **44 px**. Nothing depends on hover.
- Body text at least **16 px**, strong contrast in **both light and dark mode**.
- Quick, smooth transitions; items are revealed gently; respect **reduced motion**.
- One icon set: **lucide-react**. No emoji as icons.
- Big, confident money numbers with **tabular (fixed-width) digits**.
- Friendly **inline SVG illustrations** for empty states.
- **Skeleton loaders**, never blank screens.
- Every screen has a loading state, an empty state, and an error state with a retry.
- Avoid template looks: no purple gradients, not everything centred, not identical boxes everywhere.

**Technical limits (so the design can be built quickly)**
- React + plain CSS (one stylesheet with CSS variables). No UI framework, no Tailwind.
- Icons from lucide-react only. Fonts from Google Fonts.
- Illustrations must be simple inline SVG (no image files, no Lottie).
- Light/dark follows the phone's system setting (there is no manual theme switch today; one could be added).

---

## 3. Design tokens (current)

### Colour

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--page` / `--bg` | `#f3f5f6` | `#0f161c` | App background |
| `--desk` | `#e4e9ec` | `#0a1014` | Area around the phone column on laptops |
| `--surface` | `#ffffff` | `#162029` | Cards, sheets, inputs |
| `--surface-2` | `#eef2f4` | `#1c2833` | Pressed states, photo placeholders, skeletons |
| `--ink` | `#14202b` | `#e8eef2` | Main text |
| `--muted` | `#53636c` | `#9aabb6` | Secondary text |
| `--line` | `#d9e1e6` | `#283743` | Borders, dividers |
| `--accent` | `#0e6a87` (deep teal) | `#5bb6d3` | Primary buttons, links, icons, selected states |
| `--accent-strong` | `#0a5770` | `#7cc7df` | Primary button hover |
| `--accent-soft` | `#e3f0f4` | `#15303b` | Icon tiles, selected chip/tile background |
| `--accent-ink` | `#ffffff` | `#06222c` | Text on accent |
| `--tag` | `#e3a33a` (amber) | `#edb456` | "Evidence tag" timestamp labels on photos |
| `--tag-ink` | `#3a2606` | `#2a1b03` | Text on amber tag |
| `--danger` | `#b3261e` | `#f2837a` | Delete buttons, errors |
| `--danger-soft` | `#fbe9e7` | `#3a1c1a` | Error icon background |
| `--art-fill` / `--art-line` | `#e3f0f4` / `#9fb3bd` | `#173440` / `#5d7885` | Illustrations |

Special case: the **Home total card** is filled with `--accent` in light mode. In dark mode it uses a gradient `#125a70 → #0c3f50` with white text.

### Typography

| Role | Font | Size / weight |
|---|---|---|
| Display (headings, big totals, wordmark) | **Archivo** | h1 1.85rem/800, h2 1.3rem/700, h3 1.05rem/700; letter-spacing −0.01em |
| Body | **IBM Plex Sans** | 16px/400, line-height 1.5; labels 600 |
| Mono (money in lists, eyebrows, timestamps) | **IBM Plex Mono** | 500 |
| Big total | Archivo 800 | 2.75rem, letter-spacing −0.03em, tabular digits |
| Eyebrow label (e.g. "HOME TOTAL") | Plex Mono | 0.75rem, uppercase, letter-spacing 0.08em, muted |
| Small text | Plex Sans | 0.875rem |

### Shape, depth, spacing

- **Radius:** cards 16px, buttons 14px (small buttons 10px), inputs 12px, icon tiles 14px, sheets 22px (top corners), chips fully round, photo thumbnails 10px.
- **Shadow:** cards `0 1px 2px rgba(20,32,43,.05), 0 4px 14px rgba(20,32,43,.05)`; sheets `0 -8px 30px rgba(20,32,43,.14)`. Dark mode uses almost no shadow.
- **Page padding:** 16px sides. Vertical gap between page sections 16px; between list cards 10px.
- **Button height:** 52px (small 44px, big 58px).
- **Input height:** 52px, 1.5px border, focus ring = 3px accent at 22% opacity.

### Motion

- Screen enter: fade + 6px rise, 0.22s.
- Items on the results screen appear one by one every 450 ms (fade + 10px rise + slight scale).
- Bottom sheets slide up 0.24s; backdrop fades.
- Buttons scale to 0.98 when pressed; cards to 0.985.
- Skeletons shimmer. Camera shows a white flash each time a photo is taken.
- All animation is turned off when the user prefers reduced motion.

### Icons in use (lucide-react)

House, MapPin, Plus, ChevronLeft, ChevronRight, EllipsisVertical, Pencil, Trash2, FileText, Video, Upload, Check, RotateCcw, ScanLine, Images, X, LogOut, Volume2, VolumeX, ShieldCheck, CircleAlert, RefreshCw, ImageOff, Download, ExternalLink, CloudLightning (hurricane), Flame (fire), ShieldAlert (break-in), CircleHelp (other).
Room types: BedDouble (bedroom), CookingPot (kitchen/dining), Sofa (living room), Bath (bathroom), Monitor (office/study), Car (garage/storage), DoorOpen (any other room). The icon is picked from the room's name.

---

## 4. Components (current)

**App frame**
- Phone column, max 480px, centred. On wider screens it gets a thin border and soft shadow over the `--desk` background.
- **Top bar** (sticky, translucent with blur): logo mark + "HomeProof" wordmark on the left (taps to My Homes); round avatar on the right (user's initial on teal, or their Google photo).
- **Account menu** (drops down from the avatar): name + email, "Voice summaries" toggle switch (only if voice is enabled), "Log out".
- **Footer** (small, muted, centred): "Values are estimates, not appraisals." and "Voice by ElevenLabs" when voice is on.

**Logo mark:** teal rounded square, white house outline, amber check mark inside.

**Bottom bar:** fixed to the bottom of the phone column, nearly opaque page colour with blur and a top border. It holds one or two buttons in a row; the primary one stretches. It can also show a short note above the buttons.

**Buttons:** primary (teal fill), secondary (white/surface with border), danger (red fill), link-style text button (teal text). Buttons with icons have the icon on the left.

**Icon button:** 44×44, transparent, used for ⋮ menus and closing sheets.

**Back link:** teal chevron + text of the parent screen ("My Homes", "Home", or the home's name), top-left.

**Cards:**
- *Home card:* teal icon tile (house) · name, address with pin, "3 rooms · 20 items" · value in mono on the right + chevron.
- *Room card:* 60×60 photo of the room's most valuable item (cropped to that item) with a small room-type badge in its corner; if not scanned, a teal icon tile instead · room name, "7 items · Sep 24" or "Not scanned yet" · room total + chevron.
- *Summary/total card:* eyebrow label, big total, one line of muted detail.
- *Item card (results):* square photo on the left (100px; 80px on small phones) zoomed on the item, with an amber mono timestamp tag in the bottom-left ("00:12") · item name (bold) · value (mono, right) · "Electronics · Good" (+ "EDITED" chip if the user changed it) · range "$150–$300" (mono, small, muted).
- *Item editor (inline, replaces the card body when tapped):* "Item" text field, "Estimated value ($)" field, delete (bin icon, red), Cancel, Save. Delete asks inline: "Delete "X"? It will be removed from this room and your report." Keep / Delete.

**Bottom sheet:** handle bar, title + close X, content. Used for: add home form, rename, edit address, options menus (list of icon + label rows, delete row in red), and confirmations (Cancel / red confirm button side by side).

**Form field:** bold label above, 52px input, hint text or red error text below.

**Chips:** rounded pills with a room icon + label; selected = soft teal background + teal border.

**Event tiles (report):** 2×2 grid of large tiles, icon top-left, label bottom-left; selected = soft teal + teal border.

**States:**
- *Empty state:* SVG illustration (about 200px wide), heading, short muted text, optional button, all centred.
- *Error state:* red circle with alert icon, heading, message, "Try again" secondary button.
- *Skeletons:* shimmering bars shaped like the cards and total card.
- *Splash (checking login):* logo mark gently pulsing, centred.

**Illustrations (inline SVG, drawn in theme colours):** house with amber "+" badge (no homes); floor plan with amber "+" (no rooms); box with teal magnifying glass (no items); document with amber check (report).

---

## 5. Screens (current)

URLs are real, so refresh and back work. Everything except Login needs a logged-in user.

### 5.1 Login / Sign up — `/login`
- Top-left: big logo mark (56px), "HomeProof" (2.4rem Archivo), tagline "Film your room once. Be ready for anything." in muted display font.
- White card: title "Log in" (or "Create your account"), "Continue with Google" button (Google's own button; hidden if Google isn't set up), "or" divider, Email, Password (sign-up adds Name first; password hint "At least 8 characters"), primary full-width "Log in" / "Create account", then "New to HomeProof? **Sign up**" / "Already have an account? **Log in**".
- Below the card: shield icon + "Your videos never leave your phone. Only item photos are saved."
- States: inline field errors; wrong password shows under the password field; button text "One moment…" while waiting.

### 5.2 My Homes — `/homes`
- Eyebrow "HI AYUSH", h1 "My Homes".
- If more than one home: "EVERYTHING YOU OWN" + combined total.
- List of home cards.
- Bottom bar: primary "+ Add home".
- **Empty (new user):** house illustration, "Add your first home to start your inventory", "Then film each room. HomeProof lists what you own and what it's worth.", big "+ Add home" button (no bottom bar).
- **Add home sheet:** "Name" (placeholder "Miami Apartment"), "Address (optional)" with hint "Shown on your claim report.", "Save home". Saving opens the new home.
- Loading: skeleton total + 2 card skeletons. Error: error state with retry.

### 5.3 Home — `/homes/:homeId`
- Top row: "‹ My Homes" back link, ⋮ options button.
- h1 home name; address with pin icon underneath.
- **Home total card** (teal filled): "HOME TOTAL", big total, "20 items · 3 rooms · estimated replacement value".
- h2 "Rooms", then room cards.
- Bottom bar: "+ Add room" (secondary; shows "+ Room" on narrow phones) and primary "Get your claim report". If no room has items yet: note "Scan a room to unlock your claim report." above, "Add room" becomes primary, and a disabled "Report" button.
- **Empty rooms:** floor-plan illustration, "No rooms yet", "Add a room and film it. HomeProof finds every item worth claiming."
- **Options sheet:** Rename home, Edit address (or Add address), Delete home (red). Delete confirmation: "Delete this home?" + what will be lost + Cancel / "Delete home".

### 5.4 Add room — `/homes/:homeId/rooms/new`
- Back link (home name), h1 "Add a room".
- "Room name" field (placeholder "e.g. Bedroom") + quick-pick chips with icons: Bedroom, Kitchen, Living room, Bathroom, Office, Garage.
- Card "How to film a room": 1. Stand in the doorway and turn on good light. 2. Walk slowly around the room for 20–60 seconds. 3. Pause on valuable things: TVs, laptops, jewelry, bikes. Small note: "Up to 2 minutes per room. Your video is never uploaded, only a few photos."
- Bottom bar: "Upload a video" (secondary) + "Record" (primary).
- Error if no name: "Name the room first, or tap one of the suggestions." under the field.

**Camera (full screen, black):**
- Top: close X (hidden while recording), timer pill "● 0:12 / 2:00" (red blinking dot while recording), photo counter "🖼 7" (Images icon + count). A thin red progress line along the top edge fills toward 2:00.
- Bottom (over a dark gradient): hint text, then a large round shutter (84px, white ring, red disc; while recording the disc becomes a red rounded square = stop).
- Hints: "Walk slowly around the room. Point at everything you own." → while recording "Keep going… at least 10 seconds" (stop disabled) → "Tap stop when you've covered the room" → "15 seconds left" near the end → "Saving photos…".
- White flash each time a photo is taken (every 2 s). Auto-stops at 2:00.

**Scanning (after Stop or after choosing a video):**
- Filmstrip: horizontal row of 96px square photo thumbnails (the photos taken), gently pulsing while the AI works. Caption "12 photos from your walk-through".
- Three steps with round markers (done = teal filled with check, active = spinner, pending = number): "Picking the best shots" (with %), "Sending photos" (with %), "Identifying your things" (with seconds counter).
- Note: "Gemini is naming each item and estimating what it would cost to replace. Usually 10–20 seconds."
- Error: error state "That scan didn't work" + message + "Try again" (re-sends the same photos); bottom bar "Record or upload again".

### 5.5 Room results — `/homes/:homeId/rooms/:roomId`
- Top row: "‹ Home" back link, ⋮ options.
- Room icon tile + h1 room name.
- **Total card (white):** "ROOM TOTAL" (or "FINDING YOUR THINGS…" during the reveal), big total that counts up as items appear, "7 items · estimated replacement value · scanned Sep 24" (during reveal "2 of 7 items…").
- Item cards (see components). Right after a scan they appear one by one, and a voice summary plays ("I found 14 items worth about $3,200. Your most valuable item is your MacBook, around $1,800.").
- Below the list: "Values are AI estimates, not appraisals. Tap any item to correct it."
- Bottom bar: "Re-scan" (secondary) + "Done" (primary, back to Home).
- **Not scanned yet:** box illustration, "This room hasn't been scanned yet", bottom bar "Scan this room".
- **Scanned but nothing found:** "No items found", "Try again with more light, slower movement and the camera closer to your things.", bottom bar "Scan again".
- **Options sheet:** Rename room, Re-scan room, Delete room (red). Re-scan confirmation: "Re-scan this room? The new scan will replace the 7 items in Bedroom, including any edits you made." Cancel / "Replace items". Then the Add-room scan flow (without the name field) runs in place.

### 5.6 Claim report — `/homes/:homeId/report`
- Back link (home name), eyebrow "CLAIM REPORT", h1 home name.
- Summary card: small document illustration + total + "20 items in 3 rooms, grouped by room with photos".
- "What happened?" 2×2 event tiles: Hurricane, Fire, Break-in, Other (Hurricane selected by default).
- "Date of the event (optional)" date field (can't be in the future).
- Small note: "Values are estimated replacement costs, not a certified appraisal."
- Bottom bar: "Generate report" → while working: spinner + "Writing your report…" → on error "Try again" with the error text above.
- **Ready state** (replaces the form): card with teal border, "Your claim report is ready", "It's downloading now. Send it to your insurer with your claim.", "Open report" (primary), "Download PDF" (secondary), "Change event details" (link). The PDF downloads automatically and a voice line plays.
- **Nothing to report:** box illustration, "Nothing to report yet", "Add and scan a room" button.

### 5.7 Claim report PDF (for reference, US Letter)
Header with logo + "HomeProof", report ID and date on the right · "Home Inventory Claim Report" · three columns: Prepared for / Property / Event · light-teal box with the total, "N items · M rooms", and a 2–3 sentence AI summary · items grouped by room (72×54 photo zoomed on the item with amber timestamp, name, category · condition, value, "Range $x–$y"), room subtotal · teal "Grand total (estimated)" bar · footer on every page: "Values are estimated replacement costs generated by HomeProof. Not a certified appraisal." + "Page X of Y".

---

## 6. Known weak spots (where help is most welcome)

- **Home and My Homes screens feel plain:** a list of similar white cards under a big number. There's little sense of "protection" or progress (for example, how many rooms are covered).
- **Login screen** is functional but generic: logo, title, card. It could introduce the product better (what it does in 3 steps) without becoming a marketing page.
- **Results screen** is long and uniform. Consider grouping, showing the most valuable items first, or a clearer "evidence" feel for the photos.
- **Scanning screen** is the most "magical" moment of the demo but is visually simple (filmstrip + checklist). It needs to feel alive for 10–20 seconds without being gimmicky.
- **Report screen:** the success state could feel more like a finished, trustworthy document (preview of the first page, report ID).
- **Dark mode** accent (`#5bb6d3`) with dark text on primary buttons reads a bit light and playful. Check that it still feels calm and serious.
- **Desktop/projector view** is just the phone column on a grey background. It could frame the phone column more intentionally for judging on a big screen.
- **Empty states** are all centred and similar; the brief warns against "everything centred".
- There is no onboarding for first-time users beyond the empty state.

---

## 7. What to send back

Please return one Markdown file that can be implemented directly:

1. **Tokens:** the full list of CSS variables for light and dark (colours, fonts, radii, shadows, spacing), with exact values. Say which ones changed.
2. **Components:** for each component in section 4 (and any new one), its anatomy, sizes, spacing, colours by token name, and all states (default, pressed, focus, disabled, selected, error, loading).
3. **Screens:** for each screen in section 5, the layout from top to bottom, exact copy for any new or changed text, and its loading, empty and error states. ASCII sketches or short descriptions are fine.
4. **Motion:** durations and easing for anything new.
5. **Illustrations/icons:** describe any new SVG illustration simply enough to draw with basic shapes; use lucide icon names.
6. Keep every rule in section 2. If a proposal breaks one, call it out explicitly.
7. Keep the same screens and flows (they're wired to the backend). New visual elements are fine; new features should be listed separately as optional.
