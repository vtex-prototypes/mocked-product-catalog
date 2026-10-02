#!/usr/bin/env node
// Compares catalog.json at a git ref with the working copy and prints the
// semver bump it needs: major (something a prototype can rely on was removed),
// minor (something was added) or patch (only values changed). Prints "none"
// when nothing changed. The report goes to stderr, the bump to stdout.
// Usage: node scripts/compat.mjs <ref> [--allow-breaking]
// Exits 1 on a breaking change unless --allow-breaking is passed.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [ref, ...flags] = process.argv.slice(2);
if (!ref) {
  console.error("Usage: node scripts/compat.mjs <ref> [--allow-breaking]");
  process.exit(2);
}

const before = JSON.parse(execFileSync("git", ["show", `${ref}:catalog.json`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
const after = JSON.parse(readFileSync(join(ROOT, "catalog.json"), "utf8"));

// Every id a prototype can reference, as "kind:path" strings.
function ids(catalog) {
  const out = new Set();
  for (const c of catalog.categories) out.add(`category:${c.id}`);
  for (const b of catalog.brands) out.add(`brand:${b.id}`);
  for (const s of catalog.specifications) {
    out.add(`specification:${s.id}`);
    for (const v of s.values) out.add(`specification value:${s.id}/${v.id}`);
  }
  for (const p of catalog.products) {
    out.add(`product:${p.id}`);
    for (const o of p.options) {
      out.add(`option:${p.id}/${o.id}`);
      for (const v of o.values) out.add(`option value:${p.id}/${o.id}/${v.id}`);
    }
    for (const v of p.variants) out.add(`variant:${p.id}/${v.id}`);
  }
  return out;
}

// Every field path in use, with array indexes collapsed, e.g.
// "products[].variants[].price.BRL". A path that disappears breaks readers.
function paths(value, prefix = "", out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) paths(item, `${prefix}[]`, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const key = prefix ? `${prefix}.${k}` : k;
      out.add(key);
      paths(v, key, out);
    }
  }
  return out;
}

const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();
const idsBefore = ids(before), idsAfter = ids(after);
const pathsBefore = paths(before), pathsAfter = paths(after);

const removed = [...diff(idsBefore, idsAfter), ...diff(pathsBefore, pathsAfter).map((p) => `field:${p}`)];
const added = [...diff(idsAfter, idsBefore), ...diff(pathsAfter, pathsBefore).map((p) => `field:${p}`)];
const changed = JSON.stringify(before) !== JSON.stringify(after);

const bump = removed.length ? "major" : added.length ? "minor" : changed ? "patch" : "none";

if (removed.length) console.error(`Removed (breaking):\n${removed.map((x) => `  - ${x}`).join("\n")}`);
if (added.length) console.error(`Added:\n${added.map((x) => `  + ${x}`).join("\n")}`);
console.error(`catalog.json vs ${ref}: ${bump}`);
console.log(bump);

if (bump === "major" && !flags.includes("--allow-breaking")) {
  console.error(
    "\nThis removes something prototypes may use. Prefer keeping it. If it has to go, start the PR title with " +
      "`content!:` or `framework!:` so the release is a new major version and pinned prototypes keep working.",
  );
  process.exit(1);
}
