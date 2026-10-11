import { readFileSync } from "node:fs";
import path from "node:path";

import { suggestAnimations } from "../lib/suggest-animation";
import { analyzeSvg } from "../lib/svg-analyze";

const fixturesDir = path.join(process.cwd(), "lib", "svg-analyze.fixtures");

const EXPECT_IN_TOP3: Record<string, string> = {
  "arrow.svg": "directional-nudge",
  "rays.svg": "stagger-fade",
  "bars.svg": "fill-grow",
  "face.svg": "face-morph",
  "lock.svg": "semantic-path-length",
  "dense.svg": "peel-layers",
};

const analyses = Object.keys(EXPECT_IN_TOP3).map((file) => ({
  file,
  analysis: analyzeSvg(readFileSync(path.join(fixturesDir, file), "utf8")),
}));

suggestAnimations(analyses[0].analysis);

let ok = true;
const start = performance.now();
const results = analyses.map(({ file, analysis }) => ({
  file,
  top: suggestAnimations(analysis, 3).map((s) => s.patternId as string),
}));
const elapsed = performance.now() - start;

for (const { file, top } of results) {
  const pass = top.includes(EXPECT_IN_TOP3[file]);
  console.log(`${pass ? "PASS" : "FAIL"} ${file} top3=${top.join(",")}`);
  ok &&= pass;
}

console.log(`suggest_total_ms=${elapsed.toFixed(2)}`);
if (elapsed > 10) {
  console.error("suggest exceeded 10ms budget");
  ok = false;
}

process.exit(ok ? 0 : 1);
