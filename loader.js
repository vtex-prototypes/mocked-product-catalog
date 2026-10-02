// Loads the catalog for one prototype. Import it from a versioned URL:
//   import { loadCatalog } from "https://cdn.jsdelivr.net/gh/vtex-prototypes/mocked-product-catalog@1/loader.js";
// The catalog and photos come from the same version as this file. A range such
// as @1 is resolved to one exact release, so every file a prototype loads is
// from the same, immutable copy. Overrides are applied in memory only.

const REPO = "vtex-prototypes/mocked-product-catalog";
const SEMVER = /^\d+\.\d+\.\d+$/;

async function resolveVersion(specifier) {
  const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${REPO}/resolved?specifier=${encodeURIComponent(specifier)}`, {
    signal: AbortSignal.timeout(5000),
  });
  return (await res.json()).version ?? null;
}

// Returns the URL to load from and, when it is a release, its exact version.
async function resolveBase(base) {
  const root = base ? (base.endsWith("/") ? base : `${base}/`) : new URL("./", import.meta.url).href;
  const specifier = root.match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/[^@]+@([^/]+)\/$/)?.[1];
  if (!specifier) return { root, version: null };
  if (SEMVER.test(specifier)) return { root, version: specifier };
  try {
    const version = await resolveVersion(specifier);
    if (version && SEMVER.test(version)) return { root: `https://cdn.jsdelivr.net/gh/${REPO}@${version}/`, version };
  } catch {}
  return { root, version: null };
}

let warnedNewerMajor = false;
async function warnIfNewerMajor(version, warn) {
  if (!version || warnedNewerMajor) return;
  const latest = await resolveVersion("latest").catch(() => null);
  if (!latest || Number(latest.split(".")[0]) <= Number(version.split(".")[0])) return;
  warnedNewerMajor = true;
  warn(
    `v${latest} is out and this prototype loads v${version}. Nothing changes until you move to @${latest.split(".")[0]}. ` +
      `What it removes: https://github.com/${REPO}/releases/tag/v${latest.split(".")[0]}.0.0`,
  );
}

function warnDeprecated(products, warn) {
  for (const p of products) {
    if (p.local) continue;
    if (p.deprecated) {
      warn(`product "${p.id}" is deprecated and goes away in the next major release: ${p.deprecated.reason}` + (p.deprecated.replacedBy ? ` Use "${p.deprecated.replacedBy}".` : ""));
      continue;
    }
    for (const v of p.variants) {
      if (!v.deprecated) continue;
      warn(`variant "${p.id}/${v.id}" is deprecated and goes away in the next major release: ${v.deprecated.reason}` + (v.deprecated.replacedBy ? ` Use "${v.deprecated.replacedBy}".` : ""));
    }
  }
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Objects merge key by key; arrays and plain values replace.
function merge(target, patch) {
  if (!isObject(target) || !isObject(patch)) return structuredClone(patch);
  const out = { ...target };
  for (const [k, v] of Object.entries(patch)) out[k] = k in target ? merge(target[k], v) : structuredClone(v);
  return out;
}

function applyProductOverride(product, patch, warn) {
  const { variants: variantPatches, ...rest } = patch;
  const out = merge(product, rest);
  if (variantPatches) {
    for (const [variantId, variantPatch] of Object.entries(variantPatches)) {
      const i = out.variants.findIndex((v) => v.id === variantId);
      if (i === -1) warn(`override for variant "${product.id}/${variantId}" matches nothing in this catalog version`);
      else out.variants[i] = merge(out.variants[i], variantPatch);
    }
  }
  return out;
}

// The card fields on the product always mirror the default variant.
function syncDefault(product) {
  const def = product.variants?.find((v) => v.id === product.defaultVariantId);
  if (!def) return product;
  const out = { ...product, price: def.price, availability: def.availability };
  if (def.listPrice) out.listPrice = def.listPrice;
  else delete out.listPrice;
  return out;
}

function absolutize(product, base) {
  return {
    ...product,
    variants: product.variants.map((v) => ({
      ...v,
      images: v.images.map((img) => ({
        ...img,
        src: Object.fromEntries(Object.entries(img.src).map(([bg, path]) => [bg, new URL(path, base).href])),
      })),
    })),
  };
}

/**
 * @param {object} [options]
 * @param {string[]} [options.categories] Root or subcategory ids. Descendants are included.
 * @param {string[]} [options.products] Product ids to keep. Combined with categories when both are set.
 * @param {object} [options.overrides] { products: { [id]: patch }, add: [product], remove: [id] }
 * @param {string} [options.base] Load from this URL instead of the one this file came from.
 */
export async function loadCatalog({ categories: wantedCategories, products: wantedProducts, overrides = {}, base } = {}) {
  const warn = (msg) => console.warn(`mocked-product-catalog: ${msg}`);
  const { root, version } = await resolveBase(base);
  warnIfNewerMajor(version, warn);
  const res = await fetch(`${root}catalog.json`);
  if (!res.ok) throw new Error(`mocked-product-catalog: ${root}catalog.json returned ${res.status}`);
  const catalog = await res.json();

  let products = catalog.products.map((p) => absolutize(p, root));

  if (wantedCategories) {
    const known = new Set(catalog.categories.map((c) => c.id));
    const keep = new Set();
    for (const id of wantedCategories) {
      if (!known.has(id)) throw new Error(`mocked-product-catalog: unknown category "${id}"`);
      const subtree = subtreeOf(catalog.categories, id);
      for (const c of subtree) keep.add(c);
      if (!products.some((p) => subtree.has(p.categoryId))) {
        throw new Error(
          `mocked-product-catalog: category "${id}" has no published products in this version. ` +
            `Promote its drafts first: https://github.com/${REPO}/blob/main/CONSUMING.md#when-a-category-has-no-published-products`,
        );
      }
    }
    products = products.filter((p) => keep.has(p.categoryId));
  }

  if (wantedProducts) {
    const ids = new Set(catalog.products.map((p) => p.id));
    for (const id of wantedProducts) if (!ids.has(id)) warn(`product "${id}" is not in this catalog version`);
    const wanted = new Set(wantedProducts);
    products = products.filter((p) => wanted.has(p.id));
  }

  for (const id of overrides.remove ?? []) {
    if (!products.some((p) => p.id === id)) warn(`remove "${id}" matches nothing in this catalog version`);
  }
  const removed = new Set(overrides.remove ?? []);
  products = products.filter((p) => !removed.has(p.id));

  for (const [id, patch] of Object.entries(overrides.products ?? {})) {
    const i = products.findIndex((p) => p.id === id);
    if (i === -1) warn(`override for product "${id}" matches nothing in this catalog version`);
    else products[i] = syncDefault(applyProductOverride(products[i], patch, warn));
  }

  for (const local of overrides.add ?? []) {
    if (products.some((p) => p.id === local.id)) warn(`added product "${local.id}" replaces the catalog product with the same id`);
    products = products.filter((p) => p.id !== local.id).concat({ ...syncDefault(local), local: true });
  }

  warnDeprecated(products, warn);
  return { ...catalog, base: root, version, products };
}

function subtreeOf(categories, id) {
  const out = new Set([id]);
  for (const queue = [id]; queue.length; ) {
    const current = queue.pop();
    for (const c of categories) {
      if (c.parent !== current || out.has(c.id)) continue;
      out.add(c.id);
      queue.push(c.id);
    }
  }
  return out;
}
