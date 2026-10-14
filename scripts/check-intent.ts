import {
  INITIAL_STUDIO_STATE,
  readUpload,
  studioReducer,
} from "../components/studio/studio-state";
import { parseRefinedIntent, refineIntent } from "../lib/cursor-suggest";
import { type Casting, type MotionPlan, readIcon } from "../lib/icon-reading";
import {
  commitDescription,
  direct,
  EMPTY_INTENT,
  parseIntent,
} from "../lib/intent";

const WRAP = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${body}</svg>`;

const UP_ARROW = WRAP('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>');

let ok = true;

const check = (label: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label} ${detail}`);
  ok &&= pass;
};

function yOfHead(casting: Casting): number | undefined {
  for (const track of casting.plan.tracks.values()) {
    const y = track.frames.y?.[1];
    if (typeof y === "number") {
      return y;
    }
  }
  return undefined;
}

function rotatePeak(casting: Casting): number | undefined {
  for (const track of casting.plan.tracks.values()) {
    const rotate = track.frames.rotate;
    if (!rotate) {
      continue;
    }
    return Math.max(...rotate.map((value) => Math.abs(value)));
  }
  return undefined;
}

function serializePlan(plan: MotionPlan) {
  return {
    repeat: plan.repeat,
    tracks: [...plan.tracks.entries()].map(([key, track]) => ({
      key,
      frames: track.frames,
      origin: track.origin,
      delay: track.delay,
      feel: track.feel,
    })),
  };
}

async function main() {
  const reading = readIcon(UP_ARROW);
  const identity = direct(reading, EMPTY_INTENT);

  check(
    "direct empty intent is the same reading",
    identity === reading,
    `sameRef=${identity === reading}`
  );
  check(
    "identity keeps ranking",
    identity.ranking.join() === reading.ranking.join(),
    `got=${identity.ranking.join(",")}`
  );
  check(
    "identity keeps plans",
    reading.ranking.every(
      (id) =>
        JSON.stringify(serializePlan(identity.castings[id].plan)) ===
        JSON.stringify(serializePlan(reading.castings[id].plan))
    ),
    "plans"
  );

  const headY = yOfHead(reading.castings["directional-nudge"]);
  const down = direct(reading, parseIntent("go down"));
  const downY = yOfHead(down.castings["directional-nudge"]);
  check(
    "travel down flips an up arrow nudge to positive y",
    typeof headY === "number" &&
      typeof downY === "number" &&
      headY < 0 &&
      downY > 0,
    `before=${headY} after=${downY}`
  );

  const restPeak = rotatePeak(reading.castings["rotate-wiggle"]);
  const urgent = direct(reading, parseIntent("urgent"));
  const urgentPeak = rotatePeak(urgent.castings["rotate-wiggle"]);
  check(
    "urgent scales wiggle amplitude up",
    typeof restPeak === "number" &&
      typeof urgentPeak === "number" &&
      urgentPeak > restPeak,
    `before=${restPeak} after=${urgentPeak}`
  );

  const looping = direct(reading, parseIntent("keep going"));
  check(
    "loop description sets plan.repeat to loop",
    looping.ranking.every((id) => looping.castings[id].plan.repeat === "loop"),
    `repeat=${looping.castings[looping.ranking[0]].plan.repeat}`
  );

  const lexicon = parseIntent("notifications");
  check(
    "refine parser rejects invalid JSON",
    parseRefinedIntent("not json") === null,
    "invalid"
  );
  check(
    "refine parser rejects pattern ids",
    parseRefinedIntent(
      '{"cues":["ring"],"intensity":"normal","spans":[],"unmatched":"","patternId":"rotate-wiggle"}'
    ) === null,
    "patternId"
  );
  check(
    "refine parser rejects options payload",
    parseRefinedIntent(
      '{"options":[{"patternId":"rotate-wiggle","advice":"ring it"}]}'
    ) === null,
    "options"
  );
  check(
    "refine parser keeps a valid intent",
    parseRefinedIntent(
      '{"cues":["ring"],"intensity":"strong","spans":[{"phrase":"urgent","cue":"ring"}],"unmatched":""}'
    )?.intensity === "strong",
    "valid"
  );

  const refined = await refineIntent(
    commitDescription("notifications"),
    reading
  );
  check(
    "refine without a key keeps the lexicon intent",
    refined.source === "heuristic" &&
      refined.intent.cues.join() === lexicon.cues.join(),
    `source=${refined.source} cues=${refined.intent.cues.join(",")}`
  );

  const upload = readUpload(UP_ARROW, "up.svg");
  let studio = studioReducer(INITIAL_STUDIO_STATE, { type: "loaded", upload });
  studio = studioReducer(studio, { type: "drafted", text: "go down" });
  studio = studioReducer(studio, { type: "submitted" });
  check(
    "submit from describing plays",
    studio.status === "playing" && studio.generationId === 1,
    `status=${studio.status}`
  );
  const playing = studio;
  const same = studioReducer(studio, { type: "submitted" });
  check(
    "identical resubmit does not change state",
    same === playing ||
      (same.status === "playing" &&
        playing.status === "playing" &&
        same.generationId === playing.generationId &&
        same.description === playing.description &&
        same.directed === playing.directed),
    `gen=${same.status === "playing" ? same.generationId : same.status}`
  );
  const stale = studioReducer(studio, {
    type: "refined",
    generationId: playing.status === "playing" ? playing.generationId + 1 : 99,
    refined: {
      source: "heuristic",
      modelId: "composer-2.5",
      tier: "fast",
      reason: "stub",
      intent: parseIntent("urgent"),
      fallback: "stub",
    },
  });
  check(
    "stale generation refinements are ignored",
    stale === studio ||
      (stale.status === "playing" &&
        studio.status === "playing" &&
        stale.directed === studio.directed &&
        stale.refine.status === studio.refine.status),
    `status=${stale.status}`
  );

  process.exit(ok ? 0 : 1);
}

main();
