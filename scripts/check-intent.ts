import { type Casting, type MotionPlan, readIcon } from "../lib/icon-reading";
import { direct, EMPTY_INTENT, parseIntent } from "../lib/intent";

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

process.exit(ok ? 0 : 1);
