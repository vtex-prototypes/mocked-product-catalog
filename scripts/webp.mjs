#!/usr/bin/env node
// Writes a WebP next to every PNG in images/ that changed since the last
// release (all of them when the image rules changed, or with CHECK_ALL=1), and
// to any PNG that has none. The PNG stays: validation and `npm run backgrounds`
// read it. Prototypes load the WebP, via the src paths in catalog.json.

import { readdirSync, existsSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cpus } from "node:os";
import sharp from "sharp";
import { selectImages, pool } from "./changed-images.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "images");
const QUALITY = 82;

async function writeWebp(pngPath, webpPath) {
  await sharp(pngPath)
    .webp({ quality: QUALITY, effort: 4, smartSubsample: false, preset: "photo" })
    .toFile(webpPath);
}

const all = [];
for (const folder of readdirSync(ROOT)) {
  const dir = join(ROOT, folder);
  if (!statSync(dir).isDirectory()) continue;
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".png")) all.push(join(dir, file));
  }
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".webp")) continue;
    if (!existsSync(join(dir, file.replace(/\.webp$/, ".png")))) {
      unlinkSync(join(dir, file));
      console.log(`removed images/${folder}/${file} (no PNG source)`);
    }
  }
}

const mode = selectImages();
const webpOf = (png) => png.replace(/\.png$/, ".webp");
const todo = all.filter((png) => mode.full || mode.changed.has(png) || !existsSync(webpOf(png)));
console.log(mode.full ? `webp: full pass (${mode.reason})` : `webp: ${mode.changed.size} of ${all.length} PNGs changed since ${mode.base}`);

await pool(todo, cpus().length, (png) => writeWebp(png, webpOf(png)));

let pngBytes = 0;
let webpBytes = 0;
for (const png of todo) {
  pngBytes += statSync(png).size;
  webpBytes += statSync(webpOf(png)).size;
}

const saved = pngBytes === 0 ? 0 : (1 - webpBytes / pngBytes) * 100;
console.log(
  `${todo.length} WebP encoded this run at quality ${QUALITY}: ${(webpBytes / 1e6).toFixed(1)} MB from ${(pngBytes / 1e6).toFixed(1)} MB of PNG (${saved.toFixed(0)}% smaller).`,
);
