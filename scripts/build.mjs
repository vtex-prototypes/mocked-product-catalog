#!/usr/bin/env node
// Merges categories.json + products/*.json into catalog.json.
// Image paths are resolved to "images/<id>/<file>" so consumers can
// prefix them with the raw GitHub URL of this repo.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = join(ROOT, "products");

const categories = JSON.parse(readFileSync(join(ROOT, "categories.json"), "utf8"));
// Resolves each background filename to a repo-relative path a prototype can
// prefix with the raw GitHub URL.
function withSrc(productId, images) {
  return images.map((img) => ({
    ...img,
    src: Object.fromEntries(
      Object.entries(img.backgrounds).map(([bg, file]) => [bg, `images/${productId}/${file}`]),
    ),
  }));
}

const products = readdirSync(PRODUCTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(PRODUCTS_DIR, f), "utf8")))
  .map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({ ...v, images: withSrc(p.id, v.images) })),
  }));

// Keep the output deterministic (no timestamps) so CI can verify that the
// committed catalog.json matches the sources.
const catalog = { categories, products };

writeFileSync(join(ROOT, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`catalog.json written with ${products.length} product(s) in ${categories.length} categor(ies).`);
