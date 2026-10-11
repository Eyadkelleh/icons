import { parseSvg, readIcon } from "../lib/icon-reading";
import { boundKeys, detectFeatures } from "../lib/icon-reading/features";
import { measureFrame } from "../lib/icon-reading/geometry";

const WRAP = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${body}</svg>`;

const ICONS: Record<string, { markup: string; want: string }> = {
  wifi: {
    markup: WRAP(
      '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>'
    ),
    want: "concentric",
  },
  check: {
    markup: WRAP('<path d="M20 6 9 17l-5-5"/>'),
    want: "checks",
  },
  clock: {
    markup: WRAP('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    want: "hands",
  },
  bell: {
    markup: WRAP(
      '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'
    ),
    want: "silhouette",
  },
  search: {
    markup: WRAP('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
    want: "loupe",
  },
  smile: {
    markup: WRAP(
      '<path d="M15 10V9"/><path d="M16.472 15a6 6 0 01-8.943 0"/><path d="M9 10V9"/><circle cx="12" cy="12" r="10"/>'
    ),
    want: "face",
  },
  lock: {
    markup: WRAP(
      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
    ),
    want: "shackle",
  },
  sun: {
    markup: WRAP(
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
    ),
    want: "radial",
  },
  maximize: {
    markup: WRAP(
      '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'
    ),
    want: "corners",
  },
  copy: {
    markup: WRAP(
      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
    ),
    want: "stack",
  },
  plus: {
    markup: WRAP('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    want: "cross",
  },
  upload: {
    markup: WRAP(
      '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
    ),
    want: "arrows",
  },
};

let ok = true;
const check = (label: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label} ${detail}`);
  ok &&= pass;
};

for (const [name, { markup, want }] of Object.entries(ICONS)) {
  const frame = measureFrame(parseSvg(markup));
  const features = detectFeatures(frame);
  const present = Object.keys(boundKeys(features));
  check(
    `${name} has ${want}`,
    present.includes(want),
    `got=${present.join(",")}`
  );
  const reading = readIcon(markup);
  check(
    `${name} ranking has 12`,
    reading.ranking.length === 12,
    `n=${reading.ranking.length} top=${reading.ranking[0]}`
  );
}

const search = detectFeatures(measureFrame(parseSvg(ICONS.search.markup)));
check(
  "search is loupe not hands",
  Boolean(search.loupe) && !search.hands,
  JSON.stringify({
    loupe: Boolean(search.loupe),
    hands: Boolean(search.hands),
  })
);

const clock = detectFeatures(measureFrame(parseSvg(ICONS.clock.markup)));
check(
  "clock is hands not loupe",
  Boolean(clock.hands) && !clock.loupe,
  JSON.stringify({
    hands: Boolean(clock.hands),
    loupe: Boolean(clock.loupe),
  })
);

process.exit(ok ? 0 : 1);
