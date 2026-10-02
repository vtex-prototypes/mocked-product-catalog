#!/usr/bin/env node
// Publishes the next release from an up-to-date main: runs every check, picks
// the version from scripts/compat.mjs and `<type>!:` commit subjects, creates
// the GitHub release, waits until jsDelivr serves it, and moves @MAJOR to it.
// The release workflow runs this same script. Needs `gh` with push rights.
// Usage: npm run release [-- --dry-run]

import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const fail = (msg) => {
  console.error(`\nrelease: ${msg}`);
  process.exit(1);
};
const step = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  if (spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" }).status !== 0) fail(`${cmd} ${args.join(" ")} failed`);
};

git("fetch", "--quiet", "--tags", "origin", "main");
if (git("status", "--porcelain")) fail("the working tree has changes. Commit or stash them first.");
const head = git("rev-parse", "HEAD");
if (head !== git("rev-parse", "origin/main")) fail("release from main, up to date with origin/main.");

step("npm", ["run", "check"]);

let last = null;
try {
  last = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
} catch {}

let version, report;
if (!last) {
  version = "1.0.0";
  report = "First release.";
} else {
  const published = spawnSync("git", ["diff", "--quiet", last, "HEAD", "--", "catalog.json", "images", "loader.js"], { cwd: ROOT });
  if (published.status === 0) {
    console.log(`\nNothing prototypes load changed since ${last}. No release.`);
    process.exit(0);
  }
  const compat = spawnSync("node", ["scripts/compat.mjs", last, "--allow-breaking"], { cwd: ROOT, encoding: "utf8" });
  report = compat.stderr.trim();
  if (compat.status !== 0) fail(`not releasable:\n${report}`);
  let bump = compat.stdout.trim();
  if (bump === "none") bump = "patch";
  if (/^[a-z]+!:/m.test(git("log", "--format=%s", `${last}..HEAD`))) bump = "major";
  let [major, minor, patch] = last.slice(1).split(".").map(Number);
  if (bump === "major") [major, minor, patch] = [major + 1, 0, 0];
  else if (bump === "minor") [minor, patch] = [minor + 1, 0];
  else patch += 1;
  version = `${major}.${minor}.${patch}`;
  console.log(`\n${last} -> v${version} (${bump})`);
}

const repo = process.env.GITHUB_REPOSITORY || execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { cwd: ROOT, encoding: "utf8" }).trim();
const major = version.split(".")[0];

if (dryRun) {
  console.log(`\nDry run: would publish v${version} of ${repo} at ${head.slice(0, 7)}.\n\n${report}`);
  process.exit(0);
}

const notes = join(mkdtempSync(join(tmpdir(), "release-")), "notes.md");
writeFileSync(
  notes,
  [
    `Load it with \`https://cdn.jsdelivr.net/gh/${repo}@${version}/loader.js\`, or \`@${major}\` for the newest ${major}.x.`,
    "",
    "<details><summary>Catalog changes</summary>",
    "",
    "```",
    report,
    "```",
    "</details>",
    "",
  ].join("\n"),
);
step("gh", ["release", "create", `v${version}`, "--target", head, "--generate-notes", "--notes-file", notes]);
step("node", ["scripts/warm-cdn.mjs", repo, version]);

for (const file of ["loader.js", "catalog.json"]) {
  await fetch(`https://purge.jsdelivr.net/gh/${repo}@${major}/${file}`).catch(() => {});
}
console.log(`\nPublished v${version}: https://github.com/${repo}/releases/tag/v${version}`);
