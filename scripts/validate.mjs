#!/usr/bin/env node
// Validates every product in products/*.json and its images:
//   metadata shape, category, price, image files, PNG 1024x1024,
//   and a true-white (#FFFFFF-ish) background along the edges.
// Also validates drafts/*.json (imported photos waiting to be promoted).
// Usage: node scripts/validate.mjs [id ...]
// Exits 1 on any error. Warnings do not fail the run.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = join(ROOT, "products");
const IMAGES_DIR = join(ROOT, "images");
const DRAFTS_DIR = join(ROOT, "drafts");

const IMAGE_SIZE = 1024;
const BORDER_RING = 16; // px ring along the edges that must be the declared background
const MAX_BORDER_OFF = 0.002; // 0.2% of ring pixels may miss
// Every photo ships on both of these. #ffffff must be near-pure white.
// #f5f5f5 is painted from the white file, so the ring should be exactly 245.
const BACKGROUNDS = {
  "#ffffff": (r, g, b) => r >= 248 && g >= 248 && b >= 248,
  "#f5f5f5": (r, g, b) => Math.abs(r - 245) <= 4 && Math.abs(g - 245) <= 4 && Math.abs(b - 245) <= 4,
};

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

  const dir = join(IMAGES_DIR, id);
  if (!existsSync(dir)) err(id, `missing images folder images/${id}/`);
  const listed = validateVariants(id, p, dir);
  if (existsSync(dir) && listed) {
    for (const f of readdirSync(dir)) {
      if (f.startsWith(".")) continue;
      if (!listed.has(f)) warn(id, `images/${id}/${f} exists but is not used by any variant`);
    }
  }
}

// Options (color, size, …) and one entry per combination that is actually sold.
// Returns the set of image filenames referenced, or null if variants are missing.
function validateVariants(id, p, dir) {
  if (!Array.isArray(p.options) || p.options.length === 0) {
    err(id, `"options" must list at least one option, such as color`);
    return null;
  }
  const optionValues = new Map();
  const seenOptions = new Set();
  for (const opt of p.options) {
    if (!opt || !SLUG.test(opt.id ?? "")) { err(id, `option id "${opt?.id}" must be a kebab-case slug`); continue; }
    if (seenOptions.has(opt.id)) err(id, `duplicate option "${opt.id}"`);
    seenOptions.add(opt.id);
    checkLocalized(id, `options.${opt.id}.name`, opt.name, 2);
    if (!Array.isArray(opt.values) || opt.values.length === 0) { err(id, `option "${opt.id}" needs values`); continue; }
    const ids = new Set();
    for (const value of opt.values) {
      if (!value || !SLUG.test(value.id ?? "")) { err(id, `option "${opt.id}" has an invalid value id`); continue; }
      if (ids.has(value.id)) err(id, `option "${opt.id}" repeats value "${value.id}"`);
      ids.add(value.id);
      checkLocalized(id, `options.${opt.id}.${value.id}.name`, value.name, 1);
      if (opt.id === "color" && !/^#[0-9A-Fa-f]{6}$/.test(value.hex ?? "")) {
        err(id, `color "${value.id}" needs a "hex" swatch like "#8FA58A"`);
      }
    }
    optionValues.set(opt.id, ids);
  }

  if (!Array.isArray(p.variants) || p.variants.length === 0) {
    err(id, `"variants" must list the combinations you actually sell`);
    return null;
  }
  const variantIds = new Set();
  const listed = new Set();
  for (const v of p.variants) {
    const label = `variant ${v?.id ?? "?"}`;
    if (!v || !SLUG.test(v.id ?? "")) { err(id, `${label} id must be a kebab-case slug`); continue; }
    if (variantIds.has(v.id)) err(id, `duplicate variant "${v.id}"`);
    variantIds.add(v.id);
    if (typeof v.sku !== "string" || !v.sku.trim()) err(id, `${label} needs a "sku"`);
    for (const [optId, values] of optionValues) {
      const chosen = v.options?.[optId];
      if (!values.has(chosen)) err(id, `${label} options.${optId} "${chosen ?? ""}" is not one of ${[...values].join(", ")}`);
    }
    checkMoney(id, `${label}.price`, v.price);
    if (v.listPrice !== undefined) {
      checkMoney(id, `${label}.listPrice`, v.listPrice);
      if (v.price && v.listPrice) {
        for (const cur of CURRENCIES) {
          if (typeof v.listPrice[cur] === "number" && typeof v.price[cur] === "number" && v.listPrice[cur] <= v.price[cur]) {
            err(id, `${label} listPrice.${cur} must be greater than price.${cur}`);
          }
        }
      }
    }
    if (!AVAILABILITY.has(v.availability)) err(id, `${label} availability is invalid`);
    for (const file of validateGallery(id, label, v.images, dir)) listed.add(file);
  }
  if (!variantIds.has(p.defaultVariantId)) err(id, `"defaultVariantId" "${p.defaultVariantId ?? ""}" does not match a variant`);
  else {
    const def = p.variants.find((v) => v.id === p.defaultVariantId);
    if (def && p.price && def.price) {
      for (const cur of CURRENCIES) {
        if (p.price[cur] !== def.price[cur]) err(id, `price.${cur} must match the default variant (${def.id})`);
      }
    }
    if (def && p.availability !== def.availability) err(id, `availability must match the default variant (${def.id})`);
  }
  return listed;
}

// Each photo is one object with alt text and both background files.
function validateGallery(id, label, images, dir) {
  if (!Array.isArray(images) || images.length === 0) {
    err(id, `${label} needs at least one photo`);
    return [];
  }
  const files = [];
  images.forEach((img, i) => {
    const prefix = `${label} image ${i + 1}`;
    checkLocalized(id, `${prefix}.alt`, img?.alt, 3);
    const bgs = img?.backgrounds;
    if (!bgs || typeof bgs !== "object" || Array.isArray(bgs)) {
      err(id, `${prefix} needs a "backgrounds" object with #ffffff and #f5f5f5`);
      return;
    }
    for (const key of Object.keys(BACKGROUNDS)) {
      const file = bgs[key];
      if (typeof file !== "string" || !/^[a-z0-9-]+\.png$/.test(file)) {
        err(id, `${prefix} backgrounds["${key}"] must be a png filename`);
        continue;
      }
      files.push(file);
      const path = join(dir, file);
      if (!existsSync(path)) err(id, `missing file images/${id}/${file}`);
      else validateImage(`${id}/${file}`, path, key);
    }
    for (const key of Object.keys(bgs)) {
      if (!BACKGROUNDS[key]) err(id, `${prefix} has unknown background "${key}"`);
    }
  });
  return files;
}

function validateImage(label, path, background) {
  let png;
  try {
    png = PNG.sync.read(readFileSync(path));
  } catch (e) {
    return err(label, `not a readable PNG (${e.message})`);
  }
  const { width: w, height: h, data } = png;
  if (w !== IMAGE_SIZE || h !== IMAGE_SIZE) err(label, `must be ${IMAGE_SIZE}x${IMAGE_SIZE}, got ${w}x${h}`);

  const matches = BACKGROUNDS[background];
  let ring = 0, ringBad = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onRing = x < BORDER_RING || y < BORDER_RING || x >= w - BORDER_RING || y >= h - BORDER_RING;
      if (!onRing) continue;
      ring++;
      const i = (y * w + x) * 4;
      if (!matches(data[i], data[i + 1], data[i + 2])) ringBad++;
    }
  }
  if (ringBad / ring > MAX_BORDER_OFF) {
    err(label, `edges are not ${background} (${((ringBad / ring) * 100).toFixed(1)}% of the outer ${BORDER_RING}px is off). For #f5f5f5, run npm run backgrounds instead of redrawing the photo.`);
  }

  // Shadows, tags and text are NOT detected automatically. Simple pixel
  // heuristics cannot tell a soft shadow from the body of a white product
  // (towel, pillow, sheets), so those remain a human check in the PR template.
}

// Drafts are photos imported from the Figma board that are not compliant yet
// (off-white background, text, etc.). They only need an id, a category, a
// bilingual short name and the reference photo. Promoting one means deleting
// the draft and adding a product with regenerated images.
function validateDraft(file, productIds) {
  const id = file.replace(/\.json$/, "");
  const label = `drafts/${id}`;
  let d;
  try {
    d = JSON.parse(readFileSync(join(DRAFTS_DIR, file), "utf8"));
  } catch (e) {
    return err(label, `invalid JSON (${e.message})`);
  }
  if (d.id !== id) err(label, `"id" must equal the filename ("${d.id}")`);
  if (!SLUG.test(id)) err(label, `id must be a kebab-case slug`);
  if (productIds.has(id)) err(label, `a product with the same id exists; delete the draft once it is promoted`);
  if (!categoryIds.has(d.categoryId)) err(label, `unknown categoryId "${d.categoryId}" (see categories.json)`);
  checkLocalized(label, "name", d.name, 3);
  if (typeof d.photo !== "string" || !/^[a-z0-9-]+\.jpg$/.test(d.photo)) err(label, `"photo" must be a jpg filename`);
  else {
    const path = join(DRAFTS_DIR, d.photo);
    if (!existsSync(path)) err(label, `missing file drafts/${d.photo}`);
    else {
      const size = jpegSize(readFileSync(path));
      if (!size) err(label, `drafts/${d.photo} is not a readable JPEG`);
      else if (size.width !== IMAGE_SIZE || size.height !== IMAGE_SIZE) err(label, `drafts/${d.photo} must be ${IMAGE_SIZE}x${IMAGE_SIZE}, got ${size.width}x${size.height}`);
    }
  }
  if (d.figmaNode !== undefined && !/^\d+:\d+$/.test(d.figmaNode)) err(label, `"figmaNode" must look like "136:5642"`);
  if (d.notes !== undefined && typeof d.notes !== "string") err(label, `"notes" must be a string`);
}

// Reads width/height from the first SOF marker of a JPEG.
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

const requested = process.argv.slice(2);
const allProducts = readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".json"));
const files = allProducts.filter((f) => requested.length === 0 || requested.includes(f.replace(/\.json$/, "")));
const productIds = new Set(allProducts.map((f) => f.replace(/\.json$/, "")));
const draftFiles = existsSync(DRAFTS_DIR)
  ? readdirSync(DRAFTS_DIR).filter((f) => f.endsWith(".json")).filter((f) => requested.length === 0 || requested.includes(f.replace(/\.json$/, "")))
  : [];

if (files.length === 0 && draftFiles.length === 0) {
  console.error("Nothing to validate.");
  process.exit(1);
}

for (const f of files) validateProduct(f);
for (const f of draftFiles) validateDraft(f, productIds);
if (existsSync(DRAFTS_DIR) && requested.length === 0) {
  const used = new Set(draftFiles.map((f) => JSON.parse(readFileSync(join(DRAFTS_DIR, f), "utf8")).photo));
  for (const f of readdirSync(DRAFTS_DIR)) {
    if (f.endsWith(".jpg") && !used.has(f)) warn(`drafts/${f}`, `photo is not referenced by any draft`);
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\n${files.length} product(s) and ${draftFiles.length} draft(s) checked, ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
