import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ANIMATION_PATTERNS,
  type AnimationPatternId,
} from "../lib/animation-patterns";
import { type Casting, readIcon } from "../lib/icon-reading";
import {
  asModelIntent,
  direct,
  type Intent,
  IntentBodySchema,
  parseIntent,
} from "../lib/intent";

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

/** Labeled after the analyzer was built; never tune against these. */
const BLIND: Record<string, AnimationPatternId[]> = {
  "arrow-left": ["directional-nudge", "path-morph"],
  "arrow-big-up": ["directional-nudge", "path-morph", "scale-pulse"],
  "chevron-down": ["directional-nudge"],
  "cloud-download": ["directional-nudge"],
  "log-in": ["directional-nudge"],
  import: ["directional-nudge"],
  "arrow-up-from-line": ["directional-nudge"],
  "maximize-2": ["corner-explode"],
  "minimize-2": ["corner-explode"],
  shrink: ["corner-explode"],
  "scan-line": ["corner-explode"],
  "clock-3": ["pivot-rotate"],
  "clock-9": ["pivot-rotate"],
  watch: ["pivot-rotate"],
  "battery-low": ["fill-grow"],
  "chart-no-axes-column": ["fill-grow", "stagger-fade"],
  "signal-high": ["stagger-fade", "fill-grow"],
  "wifi-high": ["stagger-fade"],
  "sun-medium": ["stagger-fade"],
  loader: ["stagger-fade", "pivot-rotate"],
  "volume-1": ["stagger-fade"],
  "square-check": ["semantic-path-length"],
  "circle-check-big": ["semantic-path-length"],
  "lock-keyhole": ["semantic-path-length"],
  "zoom-out": ["search-bounce"],
  "search-check": ["search-bounce", "semantic-path-length"],
  annoyed: ["face-morph"],
  "smile-plus": ["face-morph"],
  "bell-dot": ["rotate-wiggle"],
  "bell-plus": ["rotate-wiggle"],
  files: ["peel-layers"],
  "copy-plus": ["peel-layers"],
  "heart-pulse": ["scale-pulse"],
  diamond: ["scale-pulse", "rotate-wiggle"],
  sparkle: ["scale-pulse", "rotate-wiggle"],
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
type Split = "dev" | "holdout" | "blind";
type Pass = "geometry" | "a" | "b" | "modelA" | "modelB";
type Tallies = Record<Split, Record<Pass, Tally>>;

type DescriptionPair = { readonly a: string; readonly b: string };
type ModelPair = { readonly a: unknown; readonly b: unknown };

function emptyTally(): Tally {
  return { icons: 0, top1: 0, top3: 0 };
}

function emptyTallies(): Tallies {
  return {
    dev: {
      geometry: emptyTally(),
      a: emptyTally(),
      b: emptyTally(),
      modelA: emptyTally(),
      modelB: emptyTally(),
    },
    holdout: {
      geometry: emptyTally(),
      a: emptyTally(),
      b: emptyTally(),
      modelA: emptyTally(),
      modelB: emptyTally(),
    },
    blind: {
      geometry: emptyTally(),
      a: emptyTally(),
      b: emptyTally(),
      modelA: emptyTally(),
      modelB: emptyTally(),
    },
  };
}

function splitOf(name: string): Split {
  if (name in BLIND) {
    return "blind";
  }
  return DEV_SET.has(name) ? "dev" : "holdout";
}

function loadDescriptions(): Record<string, DescriptionPair> {
  const file = path.join(
    process.cwd(),
    "scripts",
    "fixtures",
    "icon-descriptions.json"
  );
  return JSON.parse(readFileSync(file, "utf8")) as Record<
    string,
    DescriptionPair
  >;
}

function readModelIntent(raw: unknown): Intent | null {
  const parsed = IntentBodySchema.safeParse(raw);
  return parsed.success ? asModelIntent(parsed.data) : null;
}

function loadModelIntents(): Record<string, ModelPair> {
  const file = path.join(
    process.cwd(),
    "scripts",
    "fixtures",
    "icon-model-intents.json"
  );
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, ModelPair>;
}

function hits(
  ranking: readonly AnimationPatternId[],
  accepted: readonly AnimationPatternId[]
): { hit1: boolean; hit3: boolean } {
  const top = ranking.slice(0, 3);
  return {
    hit1: accepted.includes(top[0]),
    hit3: top.some((id) => accepted.includes(id)),
  };
}

function addHit(tally: Tally, hit: { hit1: boolean; hit3: boolean }) {
  tally.icons += 1;
  tally.top1 += Number(hit.hit1);
  tally.top3 += Number(hit.hit3);
}

const pct = (n: number, d: number) =>
  d === 0 ? "n/a" : `${((100 * n) / d).toFixed(0)}%`;
const line = (split: Split, pass: string, t: Tally) =>
  `${split.padEnd(8)} ${pass.padEnd(16)} icons=${t.icons} top1=${t.top1} (${pct(t.top1, t.icons)}) top3=${t.top3} (${pct(t.top3, t.icons)})`;

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
  const tallies = emptyTallies();
  const descriptions = loadDescriptions();
  const modelIntents = loadModelIntents();

  const labels = { ...LABELS, ...BLIND };
  const names = Object.keys(labels);
  const markups = await Promise.all(names.map(loadMarkup));
  let slowest = 0;

  for (const [index, name] of names.entries()) {
    const accepted = labels[name];
    const started = performance.now();
    const reading = readIcon(markups[index]);
    slowest = Math.max(slowest, performance.now() - started);
    const pair = descriptions[name];
    const models = modelIntents[name];
    const geo = hits(reading.ranking, accepted);
    const described = (text: string | undefined) =>
      text?.trim()
        ? hits(direct(reading, parseIntent(text)).ranking, accepted)
        : geo;
    const modeled = (raw: unknown) => {
      const intent = readModelIntent(raw);
      return intent ? hits(direct(reading, intent).ranking, accepted) : geo;
    };
    const a = described(pair?.a);
    const b = described(pair?.b);
    const modelA = modeled(models?.a);
    const modelB = modeled(models?.b);
    const split = splitOf(name);
    addHit(tallies[split].geometry, geo);
    addHit(tallies[split].a, a);
    addHit(tallies[split].b, b);
    addHit(tallies[split].modelA, modelA);
    addHit(tallies[split].modelB, modelB);
    if (verbose || !geo.hit3) {
      console.log(
        `${geo.hit1 ? "TOP1" : geo.hit3 ? "TOP3" : "MISS"} ${name.padEnd(20)} want=${accepted[0].padEnd(22)} got=${reading.ranking.slice(0, 3).join(",")}`
      );
    }
    if (plans) {
      printPlan(name, reading.castings[reading.ranking[0]]);
    }
  }

  for (const split of ["dev", "holdout", "blind"] as const) {
    console.log(line(split, "geometry-only", tallies[split].geometry));
    console.log(line(split, "+desc a", tallies[split].a));
    console.log(line(split, "+desc b", tallies[split].b));
    console.log(line(split, "+model a", tallies[split].modelA));
    console.log(line(split, "+model b", tallies[split].modelB));
  }
  console.log(`slowest_ms=${slowest.toFixed(2)}`);
}

main();
