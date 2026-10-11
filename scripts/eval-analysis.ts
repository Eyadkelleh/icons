import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ANIMATION_PATTERNS,
  type AnimationPatternId,
} from "../lib/animation-patterns";
import { type Casting, readIcon } from "../lib/icon-reading";

type IconNode = [string, Record<string, string>][];

/** Lucide icon → patterns a human animator would accept, best first. */
const LABELS: Record<string, AnimationPatternId[]> = {
  bell: ["rotate-wiggle"],
  "bell-ring": ["rotate-wiggle"],
  "alarm-clock": ["rotate-wiggle"],
  plus: ["rotate-wiggle", "scale-pulse"],
  cog: ["rotate-wiggle", "pivot-rotate"],
  settings: ["rotate-wiggle", "pivot-rotate"],
  heart: ["scale-pulse"],
  star: ["scale-pulse", "rotate-wiggle"],
  "thumbs-up": ["scale-pulse", "rotate-wiggle"],
  upload: ["directional-nudge"],
  download: ["directional-nudge"],
  "cloud-upload": ["directional-nudge"],
  "arrow-down-to-line": ["directional-nudge"],
  "log-out": ["directional-nudge"],
  "arrow-up": ["directional-nudge", "path-morph"],
  "arrow-down": ["directional-nudge", "path-morph"],
  "arrow-right": ["directional-nudge", "path-morph"],
  "square-arrow-up": ["directional-nudge", "path-morph"],
  sun: ["stagger-fade"],
  wifi: ["stagger-fade"],
  grip: ["stagger-fade"],
  signal: ["stagger-fade", "fill-grow"],
  "volume-2": ["stagger-fade"],
  radio: ["stagger-fade"],
  maximize: ["corner-explode"],
  expand: ["corner-explode"],
  minimize: ["corner-explode"],
  scan: ["corner-explode"],
  fullscreen: ["corner-explode"],
  copy: ["peel-layers"],
  "file-stack": ["peel-layers"],
  "square-stack": ["peel-layers"],
  layers: ["peel-layers", "stagger-fade"],
  clock: ["pivot-rotate"],
  history: ["pivot-rotate"],
  timer: ["pivot-rotate"],
  battery: ["fill-grow"],
  "battery-full": ["fill-grow"],
  "battery-medium": ["fill-grow"],
  "chart-column": ["fill-grow", "stagger-fade"],
  "chart-bar": ["fill-grow", "stagger-fade"],
  check: ["semantic-path-length"],
  "check-check": ["semantic-path-length"],
  "circle-check": ["semantic-path-length"],
  lock: ["semantic-path-length"],
  "lock-open": ["semantic-path-length"],
  search: ["search-bounce"],
  "zoom-in": ["search-bounce"],
  smile: ["face-morph"],
  frown: ["face-morph"],
  laugh: ["face-morph"],
  meh: ["face-morph"],
  angry: ["face-morph"],
};

const ICONS_DIR = path.join(
  process.cwd(),
  "node_modules",
  "lucide-react",
  "dist",
  "esm",
  "icons"
);

function toMarkup(node: IconNode): string {
  const children = node
    .map(([tag, attrs]) => {
      const props = Object.entries(attrs)
        .filter(([name]) => name !== "key")
        .map(([name, value]) => `${name}="${value}"`)
        .join(" ");
      return `<${tag} ${props} />`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

const ALIAS_RE = /from '\.\/([\w-]+)\.mjs'/;

async function loadMarkup(name: string): Promise<string> {
  const file = path.join(ICONS_DIR, `${name}.mjs`);
  const mod = (await import(pathToFileURL(file).href)) as {
    __iconNode?: IconNode;
  };
  if (mod.__iconNode) {
    return toMarkup(mod.__iconNode);
  }
  const target = readFileSync(file, "utf8").match(ALIAS_RE)?.[1];
  if (!target) {
    throw new Error(`No icon node for ${name}`);
  }
  return loadMarkup(target);
}

const DEV_SET = new Set(ANIMATION_PATTERNS.flatMap((p) => p.exampleIcons));

type Tally = { icons: number; top1: number; top3: number };

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0)}%`;
const line = (label: string, t: Tally) =>
  `${label.padEnd(8)} icons=${t.icons} top1=${t.top1} (${pct(t.top1, t.icons)}) top3=${t.top3} (${pct(t.top3, t.icons)})`;

function printPlan(name: string, casting: Casting) {
  const tracks = [...casting.plan.tracks.entries()].map(([key, track]) => ({
    key,
    frames: track.frames,
    origin: track.origin,
    delay: track.delay,
    feel: track.feel,
  }));
  console.log(
    JSON.stringify(
      {
        name,
        patternId: casting.patternId,
        fit: casting.fit,
        order: casting.plan.order ?? null,
        tracks,
      },
      null,
      2
    )
  );
}

async function main() {
  const verbose = process.argv.includes("--verbose");
  const plans = process.argv.includes("--plans");
  const tallies = {
    dev: { icons: 0, top1: 0, top3: 0 },
    holdout: { icons: 0, top1: 0, top3: 0 },
  };

  const names = Object.keys(LABELS);
  const markups = await Promise.all(names.map(loadMarkup));
  let slowest = 0;

  for (const [index, name] of names.entries()) {
    const accepted = LABELS[name];
    const started = performance.now();
    const reading = readIcon(markups[index]);
    slowest = Math.max(slowest, performance.now() - started);
    const ids = reading.ranking.slice(0, 3);
    const hit1 = accepted.includes(ids[0]);
    const hit3 = ids.some((id) => accepted.includes(id));
    const tally = DEV_SET.has(name) ? tallies.dev : tallies.holdout;
    tally.icons += 1;
    tally.top1 += Number(hit1);
    tally.top3 += Number(hit3);
    if (verbose || !hit3) {
      console.log(
        `${hit1 ? "TOP1" : hit3 ? "TOP3" : "MISS"} ${name.padEnd(20)} want=${accepted[0].padEnd(22)} got=${ids.join(",")}`
      );
    }
    if (plans) {
      printPlan(name, reading.castings[ids[0]]);
    }
  }

  console.log(line("dev", tallies.dev));
  console.log(line("holdout", tallies.holdout));
  console.log(`slowest_ms=${slowest.toFixed(2)}`);
}

main();
