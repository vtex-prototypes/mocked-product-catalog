// Shared by webp.mjs and validate.mjs: which PNGs need image work this run.
// Incremental (PNGs added or changed since the latest release tag, committed or
// not) unless the image rules changed since then, or CHECK_ALL=1: then every PNG.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Changing any of these can change what a PNG must pass or how it is encoded.
const RULES = ["scripts/webp.mjs", "scripts/validate.mjs", "scripts/changed-images.mjs", "package-lock.json"];

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const lines = (text) => text.split("\n").filter(Boolean);

// { full: boolean, reason: string, changed: Set<absolute png path> }
export function selectImages() {
  if (process.env.CHECK_ALL === "1") return { full: true, reason: "CHECK_ALL=1", changed: new Set() };
  let base;
  try {
    base = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
    if (!base) throw new Error("no tag");
    const rules = lines(git("diff", "--name-only", base, "--", ...RULES)).concat(lines(git("status", "--porcelain", "--", ...RULES)));
    if (rules.length) {
      const name = RULES.find((r) => git("diff", "--name-only", base, "--", r) || git("status", "--porcelain", "--", r));
      return { full: true, reason: `${name} changed since ${base}`, changed: new Set() };
    }
    const paths = lines(git("diff", "--name-only", base, "--", "images")).concat(lines(git("ls-files", "--others", "--exclude-standard", "--", "images")));
    const changed = new Set(paths.filter((p) => p.endsWith(".png")).map((p) => join(ROOT, p)).filter((p) => existsSync(p)));
    return { full: false, base, changed };
  } catch {
    return { full: true, reason: "no release tag to compare with", changed: new Set() };
  }
}

// Runs fn over items with up to `size` in flight; results keep the input order.
export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
