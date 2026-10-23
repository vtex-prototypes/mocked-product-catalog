#!/usr/bin/env node
// Merges categories.json + products/*.json into catalog.json.
// Image paths are resolved to "images/<id>/<file>" so consumers can
// prefix them with the raw GitHub URL of this repo.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = join(ROOT, "products");

const categories = JSON.parse(readFileSync(join(ROOT, "categories.json"), "utf8"));
const brands = JSON.parse(readFileSync(join(ROOT, "brands.json"), "utf8"));
const specifications = JSON.parse(readFileSync(join(ROOT, "specifications.json"), "utf8"));
const units = JSON.parse(readFileSync(join(ROOT, "units.json"), "utf8"));
const unitById = new Map(units.map((u) => [u.id, u]));
const brandById = new Map(brands.map((b) => [b.id, b]));
const specById = new Map(specifications.map((s) => [s.id, s]));

// Names live on brands.json and specifications.json. catalog.json copies them
// onto each product so a prototype can render without joining.
function resolveProduct(p) {
  const out = {};
  for (const [key, value] of Object.entries(p)) {
    if (key === "brandId") {
      out.brandId = value;
      const brand = brandById.get(value);
      out.brand = { id: brand.id, name: brand.name };
    } else if (key === "specifications") {
      out.specifications = value.map((entry) => {
        const spec = specById.get(entry.id);
        const specValue = spec.values.find((v) => v.id === entry.valueId);
        return { id: spec.id, name: spec.name, valueId: specValue.id, value: specValue.name };
      });
    } else if (key === "options") {
      out.options = value.map((opt) => {
        const spec = opt.specificationId ? specById.get(opt.specificationId) : undefined;
        if (!spec) return opt;
        return {
          id: opt.id,
          specificationId: opt.specificationId,
          name: spec.name,
          values: opt.values.map((v) => ({
            id: v.id,
            valueId: v.valueId,
            name: spec.values.find((sv) => sv.id === v.valueId).name,
          })),
        };
      });
    } else out[key] = value;
  }
  return out;
}
// Resolves each background filename to the WebP a prototype loads. The PNG
// stays in `backgrounds` as the source file.
function withSrc(productId, images) {
  return images.map((img) => ({
    ...img,
    src: Object.fromEntries(
      Object.entries(img.backgrounds).map(([bg, file]) => [
        bg,
        `images/${productId}/${file.replace(/\.png$/, ".webp")}`,
      ]),
    ),
  }));
}

// How each variant is sold, resolved into "unit": its own unitId, else the product's, else "unit".
// unitId stays only where it was set, so an override of the product's reaches every variant
// that has none. The product's unit mirrors the default variant, as its price does.
const unitOf = (id) => {
  const u = unitById.get(id);
  return { id: u.id, kind: u.kind, name: u.name };
};

const products = readdirSync(PRODUCTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(PRODUCTS_DIR, f), "utf8")))
  .map((p) => {
    const resolved = resolveProduct(p);
    const unitId = p.unitId ?? "unit";
    const variants = resolved.variants.map((v) => ({ ...v, unit: unitOf(v.unitId ?? unitId), images: withSrc(p.id, v.images) }));
    const def = variants.find((v) => v.id === p.defaultVariantId) ?? variants[0];
    return { ...resolved, unitId, unit: def.unit, variants };
  });

// Keep the output deterministic (no timestamps) so CI can verify that the
// committed catalog.json matches the sources.
const catalog = { brands, specifications, units, categories, products };

writeFileSync(join(ROOT, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`catalog.json written with ${products.length} product(s), ${brands.length} brand(s), ${specifications.length} specification(s), ${units.length} unit(s), ${categories.length} categor(ies).`);

// Drafts are published separately so catalog.json only ever contains
// compliant products. drafts.json is the queue of photos waiting for promotion.
const DRAFTS_DIR = join(ROOT, "drafts");
const drafts = existsSync(DRAFTS_DIR)
  ? readdirSync(DRAFTS_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(DRAFTS_DIR, f), "utf8")))
      .map((d) => ({ ...d, src: `drafts/${d.photo}` }))
  : [];

writeFileSync(join(ROOT, "drafts.json"), JSON.stringify({ drafts }, null, 2) + "\n");
console.log(`drafts.json written with ${drafts.length} draft(s).`);

// The store table in CONSUMING.md is generated so its counts never drift from the catalog.
const parentOf = new Map(categories.map((c) => [c.id, c.parent]));
const rootOf = (id) => {
  while (parentOf.get(id)) id = parentOf.get(id);
  return id;
};
const countByRoot = (items) => {
  const counts = new Map();
  for (const item of items) counts.set(rootOf(item.categoryId), (counts.get(rootOf(item.categoryId)) ?? 0) + 1);
  return counts;
};
const published = countByRoot(products);
const queued = countByRoot(drafts);
const rows = categories
  .filter((c) => c.parent === null)
  .map((c) => `| ${c.name.en} | \`${c.id}\` | ${published.get(c.id) ?? 0} | ${queued.get(c.id) ?? 0} |`);
const table = ["| Store | Root id | Published | Drafts |", "|---|---|---|---|", ...rows].join("\n");
const CONSUMING = join(ROOT, "CONSUMING.md");
const START = "<!-- coverage:start (generated by npm run build) -->";
const END = "<!-- coverage:end -->";
const doc = readFileSync(CONSUMING, "utf8");
const from = doc.indexOf(START);
const to = doc.indexOf(END);
if (from === -1 || to === -1) throw new Error(`CONSUMING.md is missing the ${START} / ${END} markers`);
writeFileSync(CONSUMING, doc.slice(0, from + START.length) + "\n" + table + "\n" + doc.slice(to));
console.log("CONSUMING.md coverage table written.");
