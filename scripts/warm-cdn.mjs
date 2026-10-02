#!/usr/bin/env node
// Requests every file a prototype loads from one jsDelivr version until each
// one answers 200. jsDelivr returns 404 while it is still fetching a ref it has
// not seen, so a release is warmed before the @MAJOR range is moved to it.
// Usage: node scripts/warm-cdn.mjs <owner/repo> <version>

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [repo, version] = process.argv.slice(2);
if (!repo || !version) {
  console.error("Usage: node scripts/warm-cdn.mjs <owner/repo> <version>");
  process.exit(2);
}

const catalog = JSON.parse(readFileSync(join(ROOT, "catalog.json"), "utf8"));
const files = new Set(["catalog.json", "loader.js"]);
for (const p of catalog.products) for (const v of p.variants) for (const img of v.images) for (const src of Object.values(img.src)) files.add(src);

const base = `https://cdn.jsdelivr.net/gh/${repo}@${version}/`;
const ROUNDS = 20;
const WAIT_MS = 15_000;
const CONCURRENCY = 16;

let pending = [...files];
for (let round = 1; round <= ROUNDS && pending.length; round++) {
  const failed = [];
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    await Promise.all(
      pending.slice(i, i + CONCURRENCY).map(async (file) => {
        const res = await fetch(base + file).catch(() => null);
        if (!res?.ok) failed.push(file);
        await res?.arrayBuffer().catch(() => {});
      }),
    );
  }
  console.log(`round ${round}: ${files.size - failed.length}/${files.size} files answer 200`);
  pending = failed;
  if (pending.length && round < ROUNDS) await new Promise((r) => setTimeout(r, WAIT_MS));
}

if (pending.length) {
  console.error(`Still failing after ${ROUNDS} rounds:\n${pending.map((f) => `  ${base}${f}`).join("\n")}`);
  process.exit(1);
}
