#!/usr/bin/env node
// Validates every product in products/*.json and its images:
//   metadata shape, category, price, image files, PNG 1024x1024,
//   and a true-white (#FFFFFF-ish) background along the edges.
// Usage: node scripts/validate.mjs [productId ...]
// Exits 1 on any error. Warnings do not fail the run.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = join(ROOT, "products");
const IMAGES_DIR = join(ROOT, "images");

const IMAGE_SIZE = 1024;
const WHITE_MIN = 248; // every RGB channel of a background pixel must be >= this
const BORDER_RING = 16; // px ring along the edges that must be pure background
const MAX_BORDER_NON_WHITE = 0.002; // 0.2% of ring pixels may miss (JPEG-ish noise)

const categories = JSON.parse(readFileSync(join(ROOT, "categories.json"), "utf8"));
const categoryIds = new Set(categories.map((c) => c.id));

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCIES = new Set(["BRL", "USD", "EUR"]);
const AVAILABILITY = new Set(["in_stock", "low_stock", "out_of_stock"]);

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

function validateProduct(file) {
  const id = file.replace(/\.json$/, "");
  let p;
  try {
    p = JSON.parse(readFileSync(join(PRODUCTS_DIR, file), "utf8"));
  } catch (e) {
    return err(id, `invalid JSON (${e.message})`);
  }

  if (p.id !== id) err(id, `"id" must equal the filename ("${p.id}")`);
  if (!SLUG.test(id)) err(id, `id must be a kebab-case slug`);
  if (typeof p.name !== "string" || !p.name.trim()) err(id, `"name" is required`);
  if (!categoryIds.has(p.categoryId)) err(id, `unknown categoryId "${p.categoryId}" (see categories.json)`);
  if (typeof p.description !== "string" || p.description.length < 20) err(id, `"description" must be at least 20 characters`);

  if (!p.price || typeof p.price.value !== "number" || p.price.value <= 0) err(id, `"price.value" must be a positive number`);
  if (!p.price || !CURRENCIES.has(p.price.currency)) err(id, `"price.currency" must be one of ${[...CURRENCIES].join(", ")}`);
  if (p.listPrice !== undefined) {
    if (typeof p.listPrice !== "number" || p.listPrice <= 0) err(id, `"listPrice" must be a positive number when present`);
    else if (p.price && p.listPrice <= p.price.value) err(id, `"listPrice" must be greater than price.value (it is the pre-discount price)`);
  }
  if (!AVAILABILITY.has(p.availability)) err(id, `"availability" must be one of ${[...AVAILABILITY].join(", ")}`);
  if (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== "string")) err(id, `"tags" must be an array of strings`);

  if (!Array.isArray(p.images) || p.images.length === 0) {
    err(id, `"images" must have at least one entry`);
  } else {
    const dir = join(IMAGES_DIR, id);
    if (!existsSync(dir)) err(id, `missing images folder images/${id}/`);
    p.images.forEach((img, i) => {
      if (!img || typeof img.file !== "string") return err(id, `images[${i}].file is required`);
      if (!/^\d+\.png$/.test(img.file)) err(id, `images[${i}].file must be like "1.png" (numbered PNG)`);
      if (typeof img.alt !== "string" || !img.alt.trim()) err(id, `images[${i}].alt is required`);
      const path = join(dir, img.file);
      if (!existsSync(path)) return err(id, `missing file images/${id}/${img.file}`);
      validateImage(`${id}/${img.file}`, path);
    });
    if (existsSync(dir)) {
      const listed = new Set(p.images.map((i) => i.file));
      for (const f of readdirSync(dir)) {
        if (f.startsWith(".")) continue;
        if (!listed.has(f)) warn(id, `images/${id}/${f} exists but is not listed in "images"`);
      }
    }
  }
}

function validateImage(label, path) {
  let png;
  try {
    png = PNG.sync.read(readFileSync(path));
  } catch (e) {
    return err(label, `not a readable PNG (${e.message})`);
  }
  const { width: w, height: h, data } = png;
  if (w !== IMAGE_SIZE || h !== IMAGE_SIZE) err(label, `must be ${IMAGE_SIZE}x${IMAGE_SIZE}, got ${w}x${h}`);

  const isWhite = (i) => data[i] >= WHITE_MIN && data[i + 1] >= WHITE_MIN && data[i + 2] >= WHITE_MIN;
  const idx = (x, y) => (y * w + x) * 4;

  // 1. Border ring must be white.
  let ring = 0, ringBad = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onRing = x < BORDER_RING || y < BORDER_RING || x >= w - BORDER_RING || y >= h - BORDER_RING;
      if (!onRing) continue;
      ring++;
      if (!isWhite(idx(x, y))) ringBad++;
    }
  }
  if (ringBad / ring > MAX_BORDER_NON_WHITE) {
    err(label, `background is not white at the edges (${((ringBad / ring) * 100).toFixed(1)}% of the outer ${BORDER_RING}px is off-white). Product too close to the edge, or background is gray.`);
  }

  // Shadows, tags and text are NOT detected automatically. Simple pixel
  // heuristics cannot tell a soft shadow from the body of a white product
  // (towel, pillow, sheets), so those remain a human check in the PR template.
}

const requested = process.argv.slice(2);
const files = readdirSync(PRODUCTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => requested.length === 0 || requested.includes(f.replace(/\.json$/, "")));

if (files.length === 0) {
  console.error("No products to validate.");
  process.exit(1);
}

for (const f of files) validateProduct(f);

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\n${files.length} product(s) checked, ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
