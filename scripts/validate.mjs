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

const LOCALES = ["en", "pt-BR"]; // every human-readable string must exist in all of these
const CURRENCIES = ["BRL", "USD"]; // every price must exist in all of these
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AVAILABILITY = new Set(["in_stock", "low_stock", "out_of_stock"]);
const MIN_NAME_LENGTH = 60; // marketplace-style long names, so prototypes see realistic wrapping
const MIN_DESCRIPTION_LENGTH = 80;

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

// { "en": "...", "pt-BR": "..." } with every locale present and non-empty.
function checkLocalized(id, field, value, minLength = 1) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return err(id, `"${field}" must be an object with keys ${LOCALES.join(", ")}`);
  for (const loc of LOCALES) {
    const s = value[loc];
    if (typeof s !== "string" || s.trim().length < minLength) err(id, `"${field}.${loc}" must be a string with at least ${minLength} characters`);
  }
  for (const k of Object.keys(value)) if (!LOCALES.includes(k)) err(id, `"${field}" has unknown locale "${k}"`);
}

// { "en": [...], "pt-BR": [...] } arrays of strings.
function checkLocalizedList(id, field, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return err(id, `"${field}" must be an object with keys ${LOCALES.join(", ")}`);
  for (const loc of LOCALES) {
    const a = value[loc];
    if (!Array.isArray(a) || a.length === 0 || a.some((t) => typeof t !== "string" || !t.trim())) err(id, `"${field}.${loc}" must be a non-empty array of strings`);
  }
}

// { "BRL": 89.9, "USD": 19.99 } with every currency present and positive.
function checkMoney(id, field, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return err(id, `"${field}" must be an object with keys ${CURRENCIES.join(", ")}`);
  for (const cur of CURRENCIES) {
    if (typeof value[cur] !== "number" || !(value[cur] > 0)) err(id, `"${field}.${cur}" must be a positive number`);
  }
  for (const k of Object.keys(value)) if (!CURRENCIES.includes(k)) err(id, `"${field}" has unknown currency "${k}"`);
}

const categories = JSON.parse(readFileSync(join(ROOT, "categories.json"), "utf8"));
const categoryIds = new Set(categories.map((c) => c.id));
for (const c of categories) {
  if (!SLUG.test(c.id ?? "")) err(`categories.json`, `category id "${c.id}" must be a kebab-case slug`);
  checkLocalized(`categories.json/${c.id}`, "name", c.name, 2);
  if (c.parent !== null && !categoryIds.has(c.parent)) err(`categories.json/${c.id}`, `unknown parent "${c.parent}"`);
}

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
  if (p.brand !== undefined && (typeof p.brand !== "string" || !p.brand.trim())) err(id, `"brand" must be a non-empty string when present`);
  if (!categoryIds.has(p.categoryId)) err(id, `unknown categoryId "${p.categoryId}" (see categories.json)`);
  checkLocalized(id, "name", p.name, MIN_NAME_LENGTH);
  checkLocalized(id, "description", p.description, MIN_DESCRIPTION_LENGTH);

  checkMoney(id, "price", p.price);
  if (p.listPrice !== undefined) {
    checkMoney(id, "listPrice", p.listPrice);
    if (p.price && typeof p.price === "object" && p.listPrice && typeof p.listPrice === "object") {
      for (const cur of CURRENCIES) {
        if (typeof p.listPrice[cur] === "number" && typeof p.price[cur] === "number" && p.listPrice[cur] <= p.price[cur]) {
          err(id, `"listPrice.${cur}" must be greater than price.${cur} (it is the pre-discount price)`);
        }
      }
    }
  }
  if (!AVAILABILITY.has(p.availability)) err(id, `"availability" must be one of ${[...AVAILABILITY].join(", ")}`);
  checkLocalizedList(id, "tags", p.tags);

  if (!Array.isArray(p.images) || p.images.length === 0) {
    err(id, `"images" must have at least one entry`);
  } else {
    const dir = join(IMAGES_DIR, id);
    if (!existsSync(dir)) err(id, `missing images folder images/${id}/`);
    p.images.forEach((img, i) => {
      if (!img || typeof img.file !== "string") return err(id, `images[${i}].file is required`);
      if (!/^\d+\.png$/.test(img.file)) err(id, `images[${i}].file must be like "1.png" (numbered PNG)`);
      checkLocalized(id, `images[${i}].alt`, img.alt, 3);
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
