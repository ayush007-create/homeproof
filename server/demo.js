import bcrypt from "bcryptjs";
import { placeholderPng } from "./placeholder.js";
import * as store from "./store.js";
import { HOME_RADIUS_M, unitKey } from "./geo.js";

// Creates (or resets) the demo account with one home and three scanned rooms.

export const DEMO_EMAIL = "demo@homeproof.app";
export const DEMO_PASSWORD = "HomeProof2026";

// [name, category, condition, value, low, high, placeholder shape]
const ROOMS = {
  Bedroom: [
    ["Queen memory-foam mattress", "Furniture", "good", 750, 550, 950, "bed"],
    ["Upholstered queen bed frame", "Furniture", "good", 420, 300, 560, "bed"],
    ["6-drawer wooden dresser", "Furniture", "good", 380, 260, 520, "box"],
    ["Apple iPad Air 11-inch", "Electronics", "new", 599, 520, 680, "laptop"],
    ["Dyson Supersonic hair dryer", "Appliances", "good", 400, 330, 430, "round"],
    ["Brown leather jacket", "Clothing", "good", 250, 160, 340, "box"],
    ["Bedside table lamp", "Decor", "good", 45, 30, 70, "lamp"],
  ],
  "Living room": [
    ["Samsung 65-inch 4K TV", "Electronics", "good", 900, 700, 1100, "tv"],
    ["Sony PlayStation 5", "Electronics", "good", 480, 420, 520, "box"],
    ["3-seat fabric sofa", "Furniture", "good", 1100, 800, 1500, "sofa"],
    ["Sonos Beam soundbar", "Electronics", "good", 450, 400, 500, "tv"],
    ["Oak coffee table", "Furniture", "fair", 180, 120, 260, "table"],
    ["8x10 area rug", "Decor", "good", 300, 180, 450, "table"],
    ["Arc floor lamp", "Decor", "good", 90, 60, 140, "lamp"],
  ],
  Kitchen: [
    ["KitchenAid stand mixer", "Kitchen", "good", 430, 380, 480, "round"],
    ["Nespresso Vertuo coffee machine", "Kitchen", "good", 180, 150, 220, "box"],
    ["Vitamix blender", "Kitchen", "good", 400, 320, 480, "lamp"],
    ["Stainless steel cookware set", "Kitchen", "good", 350, 250, 450, "round"],
    ["Countertop microwave", "Appliances", "fair", 150, 100, 200, "tv"],
    ["Dining table with 4 chairs", "Furniture", "good", 650, 450, 900, "table"],
  ],
};

// A few serial numbers so the demo shows them in the app and the claim report.
const DEMO_SERIALS = {
  "Apple iPad Air 11-inch": "DMPX4K2LQ1GC",
  "Samsung 65-inch 4K TV": "0B7K3CNT402815",
  "Sony PlayStation 5": "E4B1-2207-5519-03",
};

export async function seedDemo() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let user = await store.findUserByEmail(DEMO_EMAIL);
  if (user) {
    for (const home of await store.listHomes(user._id)) await store.deleteHome(user._id, home._id);
    user = await store.updateUser(user._id, { name: "Demo User", passwordHash });
  } else {
    user = await store.createUser({ name: "Demo User", email: DEMO_EMAIL, passwordHash });
  }

  // A real Miami address, looked up the same way the app does it (see geo.js).
  const home = await store.createHome(user._id, {
    name: "Miami Apartment",
    address: "1450 Brickell Avenue, Apt 2104, Miami, FL 33131",
    unit: "Apt 2104",
    location: { lat: 25.7586738, lng: -80.1931402 },
    locationSource: "address",
    radiusM: HOME_RADIUS_M,
    addressKey: `1450|brickellavenue|33131|us#${unitKey("Apt 2104")}`,
    unitKey: unitKey("Apt 2104"),
  });

  let daysAgo = 3;
  for (const [roomName, rows] of Object.entries(ROOMS)) {
    const room = await store.createRoom(home._id, { name: roomName });
    const items = [];
    for (const [i, [name, category, condition, estValue, estLow, estHigh, shape]] of rows.entries()) {
      const photoId = await store.savePhoto({ data: placeholderPng(category, shape), mimeType: "image/png", roomId: room._id, userId: user._id });
      const seconds = 2 + i * 6;
      items.push({
        name, category, condition, estValue, estLow, estHigh,
        confidence: 0.85,
        frame: i * 3,
        timestamp: `00:${String(seconds).padStart(2, "0")}`,
        photoId,
        hasSerial: category === "Electronics" || name === "Countertop microwave",
        serialNumber: DEMO_SERIALS[name] || "",
      });
    }
    await store.replaceRoomItems(home._id, room._id, items, "demo data");
    await store.updateRoom(home._id, room._id, { scannedAt: new Date(Date.now() - daysAgo-- * 86_400_000) });
  }
  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
}
