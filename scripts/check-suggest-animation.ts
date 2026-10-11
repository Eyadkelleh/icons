import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnimationPatternId } from "../lib/animation-patterns";
import { type Casting, type MotionPlan, readIcon } from "../lib/icon-reading";

const fixturesDir = path.join(process.cwd(), "lib", "svg-analyze.fixtures");

const WRAP = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${body}</svg>`;

const EXPECT_IN_TOP3: Record<string, AnimationPatternId> = {
  "arrow.svg": "directional-nudge",
  "rays.svg": "stagger-fade",
  "bars.svg": "fill-grow",
  "face.svg": "face-morph",
  "lock.svg": "semantic-path-length",
  "dense.svg": "stagger-fade",
};

const UP_ARROW = WRAP('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>');
const CLOCK = WRAP('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>');
const WIFI = WRAP(
  '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>'
);

let ok = true;
const start = performance.now();

const check = (label: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label} ${detail}`);
  ok &&= pass;
};

const loadFixture = (file: string) =>
  readIcon(readFileSync(path.join(fixturesDir, file), "utf8"));

function yOfHead(casting: Casting): number | undefined {
  for (const track of casting.plan.tracks.values()) {
    const y = track.frames.y?.[1];
    if (typeof y === "number") {
      return y;
    }
  }
  return undefined;
}

function handOrigin(plan: MotionPlan): { x: number; y: number } | undefined {
  for (const track of plan.tracks.values()) {
    if (track.frames.rotate) {
      return track.origin;
    }
  }
  return undefined;
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

for (const [file, expected] of Object.entries(EXPECT_IN_TOP3)) {
  const reading = loadFixture(file);
  const top = reading.ranking.slice(0, 3);
  check(
    `${file} top3 includes ${expected}`,
    top.includes(expected),
    `got=${top.join(",")}`
  );
}

const up = readIcon(UP_ARROW);
const headY = yOfHead(up.castings["directional-nudge"]);
check(
  "up arrow head travels negative y",
  typeof headY === "number" && headY < 0,
  `y=${headY}`
);

const clock = readIcon(CLOCK);
const origin = handOrigin(clock.castings["pivot-rotate"].plan);
check(
  "clock hand origin is (12, 12)",
  Boolean(origin && near(origin.x, 12, 0.2) && near(origin.y, 12, 0.2)),
  `origin=${origin ? `${origin.x},${origin.y}` : "none"}`
);

const wifi = readIcon(WIFI);
check(
  "wifi stagger order is radius",
  wifi.castings["stagger-fade"].plan.order?.by === "radius",
  `order=${wifi.castings["stagger-fade"].plan.order?.by ?? "none"}`
);

const elapsed = performance.now() - start;
console.log(`suggest_total_ms=${elapsed.toFixed(2)}`);
if (elapsed > 50) {
  console.error("suggest exceeded 50ms budget");
  ok = false;
}

process.exit(ok ? 0 : 1);
