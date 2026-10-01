#!/usr/bin/env node
// Writes a WebP next to every PNG in images/. The PNG stays: validation and
// `npm run backgrounds` read it. Prototypes load the WebP, via the src paths
// in catalog.json.

import { readdirSync, existsSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "images");
const QUALITY = 82;

async function writeWebp(pngPath, webpPath) {
  await sharp(pngPath)
    .webp({ quality: QUALITY, effort: 4, smartSubsample: false, preset: "photo" })
    .toFile(webpPath);
}

let written = 0;
let pngBytes = 0;
let webpBytes = 0;

for (const folder of readdirSync(ROOT)) {
  const dir = join(ROOT, folder);
  if (!statSync(dir).isDirectory()) continue;
  const files = readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith(".png")) continue;
    const pngPath = join(dir, file);
    const webpPath = join(dir, file.replace(/\.png$/, ".webp"));
    await writeWebp(pngPath, webpPath);
    written++;
    pngBytes += statSync(pngPath).size;
    webpBytes += statSync(webpPath).size;
  }
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".webp")) continue;
    if (!existsSync(join(dir, file.replace(/\.webp$/, ".png")))) {
      unlinkSync(join(dir, file));
      console.log(`removed images/${folder}/${file} (no PNG source)`);
    }
  }
}

const saved = pngBytes === 0 ? 0 : (1 - webpBytes / pngBytes) * 100;
console.log(
  `${written} WebP written at quality ${QUALITY}: ${(webpBytes / 1e6).toFixed(1)} MB from ${(pngBytes / 1e6).toFixed(1)} MB of PNG (${saved.toFixed(0)}% smaller).`,
);
