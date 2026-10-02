#!/usr/bin/env node
// Compares catalog.json at a git ref with the working copy and prints the
// semver bump it needs: major (something a prototype can rely on was removed),
// minor (something was added) or patch (only values changed). Prints "none"
// when nothing changed. The report goes to stderr, the bump to stdout.
// Usage: node scripts/compat.mjs <ref> [--allow-breaking]
// Exits 1 on a breaking change unless --allow-breaking is passed, and always
// exits 1 when a product or variant is removed without having been deprecated
// at <ref>.

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

// Fields documented as sometimes absent. Readers already handle them missing,
// so their disappearing is not a breaking change.
const OPTIONAL = new Set(["listPrice", "deprecated", "brandId", "brand", "specifications", "specificationId", "valueId"]);

// Every required field path in use, with array indexes collapsed, e.g.
// "products[].variants[].price.BRL". A path that disappears breaks readers.
function paths(value, prefix = "", out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) paths(item, `${prefix}[]`, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (OPTIONAL.has(k)) continue;
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

// Products and variants have to be marked deprecated in one release before a
// later major release removes them, so prototypes get a warning first.
const wasDeprecated = new Set();
for (const p of before.products) {
  if (p.deprecated) wasDeprecated.add(`product:${p.id}`);
  for (const v of p.variants) if (p.deprecated || v.deprecated) wasDeprecated.add(`variant:${p.id}/${v.id}`);
}
const undeprecated = removed.filter((x) => /^(product|variant):/.test(x) && !wasDeprecated.has(x));

const nowDeprecated = [];
for (const p of after.products) {
  if (p.deprecated && !wasDeprecated.has(`product:${p.id}`)) nowDeprecated.push(`product:${p.id}${p.deprecated.replacedBy ? ` -> ${p.deprecated.replacedBy}` : ""}`);
  for (const v of p.variants) {
    if (v.deprecated && !wasDeprecated.has(`variant:${p.id}/${v.id}`)) nowDeprecated.push(`variant:${p.id}/${v.id}${v.deprecated.replacedBy ? ` -> ${v.deprecated.replacedBy}` : ""}`);
  }
}

const bump = removed.length ? "major" : added.length || nowDeprecated.length ? "minor" : changed ? "patch" : "none";

if (removed.length) console.error(`Removed (breaking):\n${removed.map((x) => `  - ${x}`).join("\n")}`);
if (added.length) console.error(`Added:\n${added.map((x) => `  + ${x}`).join("\n")}`);
if (nowDeprecated.length) console.error(`Deprecated (removed in the next major):\n${nowDeprecated.map((x) => `  ~ ${x}`).join("\n")}`);
console.error(`catalog.json vs ${ref}: ${bump}`);
console.log(bump);

if (undeprecated.length) {
  console.error(
    `\nRemoved without being deprecated first:\n${undeprecated.map((x) => `  - ${x}`).join("\n")}\n` +
      "Mark them with \"deprecated\": { \"reason\": ..., \"replacedBy\": ... } in a PR of their own, let it release, then remove them.",
  );
  process.exit(1);
}

if (bump === "major" && !flags.includes("--allow-breaking")) {
  console.error(
    "\nThis removes something prototypes may use. Prefer keeping it. If it has to go, start the PR title with " +
      "`content!:` or `framework!:` so the release is a new major version and pinned prototypes keep working.",
  );
  process.exit(1);
}
