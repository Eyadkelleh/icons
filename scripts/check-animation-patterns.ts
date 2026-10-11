import { existsSync } from "node:fs";
import path from "node:path";

import { ANIMATION_PATTERNS } from "../lib/animation-patterns";

const root = process.cwd();
const ids = new Set<string>();
let ok = true;

for (const pattern of ANIMATION_PATTERNS) {
  if (ids.has(pattern.id)) {
    console.error(`duplicate id: ${pattern.id}`);
    ok = false;
  }
  ids.add(pattern.id);

  if (!(pattern.title && pattern.when && pattern.avoid)) {
    console.error(`${pattern.id}: missing copy`);
    ok = false;
  }

  if (!pattern.exampleIcons.length) {
    console.error(`${pattern.id}: missing exampleIcons`);
    ok = false;
  }

  for (const name of pattern.exampleIcons) {
    const file = path.join(root, "icons", `${name}.tsx`);
    if (!existsSync(file)) {
      console.error(`${pattern.id}: missing icon file icons/${name}.tsx`);
      ok = false;
    }
  }
}

if (ANIMATION_PATTERNS.length !== 12) {
  console.error(`expected 12 patterns, got ${ANIMATION_PATTERNS.length}`);
  ok = false;
}

console.log(`patterns=${ANIMATION_PATTERNS.length}`);
process.exit(ok ? 0 : 1);
