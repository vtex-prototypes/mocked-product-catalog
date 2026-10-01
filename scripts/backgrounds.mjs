#!/usr/bin/env node
// Writes the #f5f5f5 twin of every *-white.png.
// The product pixels stay untouched: only the white background connected to
// the edges is repainted. Run this after adding a white photo, then commit
// both files.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "images");
const WHITE_MIN = 248;

function paint(src) {
  const png = PNG.sync.read(readFileSync(src));
  const { width: w, height: h, data } = png;
  const bg = new Uint8Array(w * h);
  const stack = [];
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x;
    if (bg[k]) return;
    const i = k * 4;
    if (data[i] >= WHITE_MIN && data[i + 1] >= WHITE_MIN && data[i + 2] >= WHITE_MIN) {
      bg[k] = 1;
      stack.push(x, y);
    }
  };
  for (let x = 0; x < w; x++) { consider(x, 0); consider(x, h - 1); }
  for (let y = 0; y < h; y++) { consider(0, y); consider(w - 1, y); }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    consider(x + 1, y); consider(x - 1, y); consider(x, y + 1); consider(x, y - 1);
  }
  for (let k = 0; k < w * h; k++) {
    if (!bg[k]) continue;
    const i = k * 4;
    data[i] = data[i + 1] = data[i + 2] = 245;
  }
  return PNG.sync.write(png);
}

let written = 0;
for (const folder of readdirSync(ROOT)) {
  const dir = join(ROOT, folder);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith("-white.png")) continue;
    const dest = join(dir, file.replace(/-white\.png$/, "-gray.png"));
    writeFileSync(dest, paint(join(dir, file)));
    written++;
    console.log(`images/${folder}/${file.replace("-white.png", "-gray.png")}`);
  }
}
console.log(`${written} background${written === 1 ? "" : "s"} written.`);
