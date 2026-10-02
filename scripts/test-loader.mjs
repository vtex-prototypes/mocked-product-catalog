#!/usr/bin/env node
// Tests loader.js against the local catalog.json, with fetch stubbed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../loader.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://catalog.test/v/";
const raw = readFileSync(join(ROOT, "catalog.json"), "utf8");
const source = JSON.parse(raw);

const CDN = "https://cdn.jsdelivr.net/gh/vtex-prototypes/mocked-product-catalog";
const RESOLVE = "https://data.jsdelivr.com/v1/packages/gh/vtex-prototypes/mocked-product-catalog/resolved?specifier=";
const routes = new Map([[`${BASE}catalog.json`, raw]]);
const resolved = (version) => JSON.stringify({ version });

globalThis.fetch = async (url) => {
  if (!routes.has(url)) throw new Error(`unexpected fetch ${url}`);
  return new Response(routes.get(url), { status: 200 });
};
const tick = () => new Promise((r) => setTimeout(r, 0));

const warnings = [];
console.warn = (msg) => warnings.push(msg);
const load = (opts) => loadCatalog({ base: BASE, ...opts });

const product = source.products.find((p) => p.variants.length > 1);
const other = product.variants.find((v) => v.id !== product.defaultVariantId);
const def = product.variants.find((v) => v.id === product.defaultVariantId);
const rootWith = (n) => source.categories.filter((c) => c.parent === null).find((r) => {
  const ids = new Set(source.categories.filter((c) => c.id === r.id || c.parent === r.id).map((c) => c.id));
  return (source.products.filter((p) => ids.has(p.categoryId)).length > 0) === (n > 0);
});

test("photo src is an absolute URL on the loaded version", async () => {
  const { products } = await load();
  const src = products[0].variants[0].images[0].src["#ffffff"];
  assert.ok(src.startsWith(`${BASE}images/`), src);
});

test("a root category includes its subcategories", async () => {
  const root = rootWith(1);
  const { products } = await load({ categories: [root.id] });
  assert.ok(products.length > 0);
  assert.ok(products.every((p) => p.categoryId === root.id || source.categories.find((c) => c.id === p.categoryId).parent === root.id));
});

test("a category with no published products fails loudly", async () => {
  const empty = rootWith(0);
  if (!empty) return;
  await assert.rejects(load({ categories: [empty.id] }), /no published products/);
});

test("an unknown category fails loudly", async () => {
  await assert.rejects(load({ categories: ["does-not-exist"] }), /unknown category/);
});

test("variant overrides merge, and the card fields follow the default variant", async () => {
  const { products } = await load({
    overrides: {
      products: {
        [product.id]: {
          variants: {
            [product.defaultVariantId]: { price: { BRL: 1.5 }, availability: "out_of_stock" },
          },
        },
      },
    },
  });
  const p = products.find((x) => x.id === product.id);
  const d = p.variants.find((v) => v.id === product.defaultVariantId);
  assert.equal(d.price.BRL, 1.5);
  assert.equal(d.price.USD, def.price.USD);
  assert.equal(p.price.BRL, 1.5);
  assert.equal(p.availability, "out_of_stock");
  assert.deepEqual(p.variants.find((v) => v.id === other.id).price, other.price);
});

test("overrides that point at missing ids warn instead of breaking", async () => {
  warnings.length = 0;
  const { products } = await load({
    overrides: { products: { gone: { name: { en: "x" } }, [product.id]: { variants: { gone: {} } } }, remove: ["gone"] },
  });
  assert.equal(products.length, source.products.length);
  assert.equal(warnings.length, 3);
});

test("remove and add change only this prototype's view", async () => {
  const local = { ...structuredClone(product), id: "local-thing" };
  const first = await load({ overrides: { remove: [product.id], add: [local] } });
  assert.ok(!first.products.some((p) => p.id === product.id));
  assert.ok(first.products.find((p) => p.id === "local-thing").local);

  const second = await load();
  assert.ok(second.products.some((p) => p.id === product.id));
  assert.ok(!second.products.some((p) => p.id === "local-thing"));
});

test("products narrows to the listed ids", async () => {
  const { products } = await load({ products: [product.id] });
  assert.deepEqual(products.map((p) => p.id), [product.id]);
});

test("deprecated products and variants warn with their replacement", async () => {
  const [first, second] = source.products;
  const withDeprecations = structuredClone(source);
  withDeprecations.products[0].deprecated = { reason: "Merged into another listing.", replacedBy: second.id };
  const v = withDeprecations.products[1].variants.find((x) => x.id !== second.defaultVariantId);
  v.deprecated = { reason: "This color is discontinued." };
  const base = "https://catalog.test/deprecated/";
  routes.set(`${base}catalog.json`, JSON.stringify(withDeprecations));

  warnings.length = 0;
  await loadCatalog({ base });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], new RegExp(`product "${first.id}" is deprecated.*Use "${second.id}"`));
  assert.match(warnings[1], new RegExp(`variant "${second.id}/${v.id}" is deprecated`));

  warnings.length = 0;
  await loadCatalog({ base, overrides: { remove: [first.id] } });
  assert.equal(warnings.length, 1, "removing a deprecated product in the prototype silences it");
});

test("a range resolves to one exact release, and the same major does not warn", async () => {
  routes.set(`${RESOLVE}1`, resolved("1.2.0"));
  routes.set(`${RESOLVE}latest`, resolved("1.3.0"));
  routes.set(`${CDN}@1.2.0/catalog.json`, raw);
  warnings.length = 0;
  const { base, version, products } = await loadCatalog({ base: `${CDN}@1/` });
  await tick();
  assert.equal(version, "1.2.0");
  assert.equal(base, `${CDN}@1.2.0/`);
  assert.ok(products[0].variants[0].images[0].src["#ffffff"].startsWith(`${CDN}@1.2.0/images/`));
  assert.equal(warnings.length, 0);
});

test("a newer major release warns once, without blocking the load", async () => {
  routes.set(`${RESOLVE}latest`, resolved("2.0.1"));
  warnings.length = 0;
  await loadCatalog({ base: `${CDN}@1.2.0/` });
  await tick();
  await loadCatalog({ base: `${CDN}@1.2.0/` });
  await tick();
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /v2\.0\.1 is out.*v1\.2\.0.*releases\/tag\/v2\.0\.0/);
});
