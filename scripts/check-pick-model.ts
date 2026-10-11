import { readFileSync } from "node:fs";
import path from "node:path";

import { type CatalogModel, pickSuggestModel } from "../lib/pick-suggest-model";
import { suggestAnimations, suggestionSpread } from "../lib/suggest-animation";
import { analyzeSvg } from "../lib/svg-analyze";

const fixturesDir = path.join(process.cwd(), "lib", "svg-analyze.fixtures");

const CATALOG_WITH_ROUTER: CatalogModel[] = [
  { id: "composer-2.5" },
  { id: "claude-opus-4-8-thinking-high" },
  {
    id: "auto-smart",
    parameters: [
      {
        id: "optimize_for",
        values: [{ value: "balanced" }, { value: "intelligence" }],
      },
    ],
  },
];
const CATALOG_NO_ROUTER: CatalogModel[] = [
  { id: "composer-2.5" },
  { id: "claude-opus-4-8-thinking-high" },
];

const pick = (file: string, catalog: CatalogModel[] | null) => {
  const analysis = analyzeSvg(
    readFileSync(path.join(fixturesDir, file), "utf8")
  );
  return pickSuggestModel(
    analysis,
    suggestionSpread(suggestAnimations(analysis)),
    catalog
  );
};

let ok = true;
const check = (label: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label} ${detail}`);
  ok &&= pass;
};

for (const [name, catalog] of [
  ["router", CATALOG_WITH_ROUTER],
  ["no-router", CATALOG_NO_ROUTER],
  ["no-catalog", null],
] as const) {
  const arrow = pick("arrow.svg", catalog);
  const dense = pick("dense.svg", catalog);
  check(
    `${name}: arrow and dense pick different models`,
    arrow.selection.id !== dense.selection.id,
    `arrow=${arrow.tier}:${arrow.selection.id} dense=${dense.tier}:${dense.selection.id}`
  );
}

const routed = pick("dense.svg", CATALOG_WITH_ROUTER);
check(
  "dense routes to auto-smart with optimize_for=intelligence",
  routed.selection.id === "auto-smart" &&
    routed.selection.params?.[0]?.value === "intelligence",
  JSON.stringify(routed.selection)
);

process.exit(ok ? 0 : 1);
