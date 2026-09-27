import zlib from "node:zlib";

// Draws simple placeholder "photos" as PNG files for the demo account,
// so the demo works in the app and in the PDF without real pictures.

const W = 480;
const H = 360;

// Soft background colour per category.
const PALETTE = {
  Electronics: [88, 120, 150],
  Furniture: [150, 118, 88],
  Appliances: [110, 140, 132],
  Kitchen: [168, 128, 84],
  Clothing: [132, 104, 140],
  Accessories: [120, 132, 96],
  Decor: [160, 110, 110],
  Other: [110, 124, 134],
};

// Each shape is [kind, x, y, w, h] in 0..1 units of the image.
const SHAPES = {
  tv: [["rect", 0.2, 0.22, 0.6, 0.38], ["rect", 0.46, 0.6, 0.08, 0.08], ["rect", 0.36, 0.67, 0.28, 0.03]],
  laptop: [["rect", 0.3, 0.3, 0.4, 0.28], ["rect", 0.24, 0.58, 0.52, 0.05]],
  sofa: [["rect", 0.18, 0.42, 0.64, 0.2], ["rect", 0.18, 0.32, 0.64, 0.12], ["rect", 0.14, 0.4, 0.07, 0.24], ["rect", 0.79, 0.4, 0.07, 0.24]],
  bed: [["rect", 0.16, 0.46, 0.68, 0.18], ["rect", 0.16, 0.28, 0.06, 0.36], ["rect", 0.26, 0.4, 0.16, 0.07]],
  table: [["rect", 0.22, 0.42, 0.56, 0.05], ["rect", 0.26, 0.47, 0.04, 0.22], ["rect", 0.7, 0.47, 0.04, 0.22]],
  box: [["rect", 0.34, 0.3, 0.32, 0.38]],
  round: [["circle", 0.5, 0.48, 0.17, 0]],
  lamp: [["rect", 0.4, 0.22, 0.2, 0.14], ["rect", 0.485, 0.36, 0.03, 0.3], ["rect", 0.42, 0.66, 0.16, 0.03]],
};

export function placeholderPng(category, shape = "box") {
  const base = PALETTE[category] || PALETTE.Other;
  const px = Buffer.alloc(W * H * 3);
  const set = (x, y, [r, g, b]) => {
    const i = (y * W + x) * 3;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  };
  const mix = (c, t) => c.map((v) => Math.round(v + (255 - v) * t));

  // Wall (light gradient) and floor.
  for (let y = 0; y < H; y++) {
    const floor = y > H * 0.7;
    const color = floor ? mix(base, 0.45) : mix(base, 0.82 - (y / H) * 0.12);
    for (let x = 0; x < W; x++) set(x, y, color);
  }

  const dark = mix(base, 0.05);
  for (const [kind, sx, sy, sw, sh] of SHAPES[shape] || SHAPES.box) {
    if (kind === "rect") {
      for (let y = Math.round(sy * H); y < Math.round((sy + sh) * H); y++)
        for (let x = Math.round(sx * W); x < Math.round((sx + sw) * W); x++) set(x, y, dark);
    } else {
      const cx = sx * W, cy = sy * H, r = sw * W;
      for (let y = Math.floor(cy - r); y < cy + r; y++)
        for (let x = Math.floor(cx - r); x < cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) set(x, y, dark);
    }
  }
  return encodePng(px);
}

function encodePng(rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); // filter byte 0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
