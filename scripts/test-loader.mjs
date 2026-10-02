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

globalThis.fetch = async (url) => {
  if (url !== `${BASE}catalog.json`) throw new Error(`unexpected fetch ${url}`);
  return new Response(raw, { status: 200 });
};

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
