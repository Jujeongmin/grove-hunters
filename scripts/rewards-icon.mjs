// Draws the rewards (attendance and achievements) menu icon, a trophy, and the mount ticket (소환권), a
// ticket with an egg on it, as 34x34 pixel art in the look of scripts/menu-icons.py (a dark outline, a
// lit left side, a shaded right), with no dependency but Node itself. Writes
// public/assets/ui/icons/ui_rewards.png and ui_ticket.png (kept on develop only, like every game asset).
//
//     node scripts/rewards-icon.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 34;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "ui", "icons");
const OUTLINE = [26, 18, 16, 255];
const GOLD = [[255, 229, 138, 255], [242, 182, 50, 255], [192, 122, 18, 255]];
const WOOD = [[196, 130, 80, 255], [150, 92, 52, 255], [104, 60, 32, 255]];
const RED = [[255, 120, 96, 255], [216, 64, 47, 255], [150, 36, 28, 255]];
const SHINE = [255, 250, 220, 255];
const LILAC = [[214, 196, 255, 255], [160, 128, 240, 255], [104, 76, 184, 255]];
const SHELL = [[255, 252, 240, 255], [240, 230, 205, 255], [196, 180, 150, 255]];
const CLEAR = [0, 0, 0, 0];

let px = [];
const fresh = () => {
  px = Array.from({ length: SIZE * SIZE }, () => [0, 0, 0, 0]);
};
const at = (x, y) => px[y * SIZE + x];
const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const set = (x, y, c) => {
  if (inside(x, y)) px[y * SIZE + x] = c;
};
const same = (a, b) => a.every((v, i) => v === b[i]);
const rect = (x0, y0, x1, y1, c) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
};
// A filled ellipse in the box (x0, y0)-(x1, y1).
const ellipse = (x0, y0, x1, y1, c) => {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 0.5, ry = (y1 - y0) / 2 + 0.5;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, c);
  }
};

// Lights the left edge of each drawn row of `base` and shades its right edge.
function shade([light, base, dark]) {
  for (let y = 0; y < SIZE; y++) {
    const xs = [];
    for (let x = 0; x < SIZE; x++) if (same(at(x, y), base)) xs.push(x);
    if (xs.length < 3) continue;
    for (const x of xs.slice(0, 2)) set(x, y, light);
    for (const x of xs.slice(-3)) set(x, y, dark);
  }
}

// A one-pixel dark outline around everything drawn (the pack's look).
function outlined() {
  const drawn = px.map((c) => c[3] > 0);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (drawn[y * SIZE + x]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy) && drawn[(y + dy) * SIZE + x + dx]) near = true;
      }
      if (near) set(x, y, OUTLINE);
    }
  }
}

function trophy() {
  const [light, base, dark] = GOLD;
  // The handles: rings either side of the cup.
  ellipse(3, 7, 11, 17, base);
  ellipse(5, 9, 9, 15, [0, 0, 0, 0]);
  ellipse(22, 7, 30, 17, base);
  ellipse(24, 9, 28, 15, [0, 0, 0, 0]);
  // The cup, the stem and the knot on it.
  rect(9, 4, 24, 8, base);
  ellipse(9, 2, 24, 20, base);
  rect(9, 2, 24, 7, base);
  rect(15, 20, 18, 24, base);
  rect(13, 23, 20, 24, base);
  shade(GOLD);
  // The rim, lit, and the cup's mouth in shadow.
  for (let x = 9; x <= 24; x++) set(x, 2, light);
  for (let x = 10; x <= 23; x++) set(x, 3, dark);
  // A star on the cup.
  const star = [[16, 8], [17, 8], [15, 10], [16, 9], [17, 9], [18, 10], [14, 10], [19, 10], [16, 10], [17, 10], [15, 11], [16, 11], [17, 11], [18, 11], [15, 12], [18, 12], [14, 13], [19, 13]];
  for (const [x, y] of star) set(x, y, light);
  // A shine down the cup's left.
  for (let y = 6; y <= 12; y++) set(11, y, SHINE);
  // The wooden base with a red plate.
  rect(10, 25, 23, 31, WOOD[1]);
  shade(WOOD);
  for (let x = 10; x <= 23; x++) set(x, 25, WOOD[0]);
  rect(13, 27, 20, 29, RED[1]);
  for (let x = 13; x <= 20; x++) set(x, 27, RED[0]);
  for (let x = 13; x <= 20; x++) set(x, 29, RED[2]);
  outlined();
}

// The pixels as a PNG (8-bit RGBA, no filtering).
function png() {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    for (let x = 0; x < SIZE; x++) raw.set(at(x, y), y * (SIZE * 4 + 1) + 1 + x * 4);
  }
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ticket() {
  const [light, base, dark] = LILAC;
  rect(2, 8, 31, 25, base);
  // The notches either side, and the tear line.
  ellipse(0, 13, 4, 19, CLEAR);
  ellipse(29, 13, 33, 19, CLEAR);
  shade(LILAC);
  for (let x = 2; x <= 31; x++) {
    if (same(at(x, 8), base) || same(at(x, 8), dark)) set(x, 8, light);
    if (at(x, 25)[3] > 0) set(x, 25, dark);
  }
  for (let y = 9; y <= 24; y += 2) set(11, y, dark);
  // Stars on the stub.
  for (const [x, y] of [[7, 11], [6, 16], [8, 21]]) {
    set(x, y, SHINE);
    set(x - 1, y, light);
    set(x + 1, y, light);
    set(x, y - 1, light);
    set(x, y + 1, light);
  }
  // The egg, with spots.
  ellipse(15, 10, 26, 23, SHELL[1]);
  shade(SHELL);
  for (const [x, y] of [[18, 14], [19, 14], [22, 17], [23, 17], [17, 19], [20, 21]]) set(x, y, LILAC[1]);
  for (let y = 12; y <= 15; y++) set(17, y, SHINE);
  outlined();
}

mkdirSync(OUT, { recursive: true });
for (const [name, draw] of [["ui_rewards", trophy], ["ui_ticket", ticket]]) {
  fresh();
  draw();
  writeFileSync(join(OUT, `${name}.png`), png());
  console.log(`${name}.png`);
}
