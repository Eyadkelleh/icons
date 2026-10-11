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

  if (!(pattern.variants.normal && pattern.variants.animate)) {
    console.error(`${pattern.id}: variants must define normal and animate`);
    ok = false;
  }
}

if (ANIMATION_PATTERNS.length < 10) {
  console.error(
    `expected at least 10 patterns, got ${ANIMATION_PATTERNS.length}`
  );
  ok = false;
}

console.log(`patterns=${ANIMATION_PATTERNS.length}`);
process.exit(ok ? 0 : 1);
