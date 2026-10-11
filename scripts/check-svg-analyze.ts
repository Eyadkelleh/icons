import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { IconReadError, measureFrame, readIcon } from "../lib/icon-reading";
import { boundKeys, detectFeatures } from "../lib/icon-reading/features";

const fixturesDir = path.join(process.cwd(), "lib", "svg-analyze.fixtures");
const snapshotPath = path.join(fixturesDir, "snapshots.json");
const update = process.argv.includes("--update");

const fingerprints: Record<string, unknown> = {};
let slowest = 0;

for (const file of readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".svg"))
  .sort()) {
  const markup = readFileSync(path.join(fixturesDir, file), "utf8");
  const start = performance.now();
  const reading = readIcon(markup);
  slowest = Math.max(slowest, performance.now() - start);
  fingerprints[file] = {
    features: boundKeys(detectFeatures(measureFrame(reading.tree))),
    ranking: reading.ranking.slice(0, 3),
  };
}

let rejected = false;
try {
  readIcon("<div>not svg</div>");
} catch (error) {
  rejected = error instanceof IconReadError;
}

if (update) {
  writeFileSync(snapshotPath, `${JSON.stringify(fingerprints, null, 2)}\n`);
  console.log(`updated ${snapshotPath}`);
  process.exit(0);
}

const expected = JSON.parse(readFileSync(snapshotPath, "utf8"));
const actual = JSON.parse(JSON.stringify(fingerprints));
const same = JSON.stringify(expected) === JSON.stringify(actual);

console.log(JSON.stringify(actual, null, 2));
console.log(
  `fixtures=${Object.keys(actual).length} slowest_ms=${slowest.toFixed(2)}`
);

if (!same) {
  console.error(
    "fingerprints differ from snapshots.json (run with --update if intended)"
  );
}
if (!rejected) {
  console.error("non-SVG input was not rejected");
}
if (slowest > 50) {
  console.error(`analyze exceeded 50ms budget: ${slowest.toFixed(2)}ms`);
}
process.exit(same && rejected && slowest <= 50 ? 0 : 1);
