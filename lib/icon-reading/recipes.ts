import {
  ANIMATION_PATTERNS,
  type AnimationPatternId,
} from "@/lib/animation-patterns";
import {
  boundKeys,
  byKey,
  type FeatureName,
  type FeatureSet,
  summarize as sceneSummary,
} from "./features";
import { boxHeight, boxWidth, type Frame, fmt, fmtVec } from "./geometry";
import type { PartKey } from "./parse";
import { add, dist, len, scale, unit, type Vec, vec } from "./path-data";

export type WholeIcon = "all";
export type TrackTarget = PartKey | WholeIcon;

export type Channel =
  | "x"
  | "y"
  | "rotate"
  | "scale"
  | "scaleX"
  | "scaleY"
  | "opacity"
  | "pathLength"
  | "pathOffset";

export const REST_POSE: Readonly<Record<Channel, number>> = {
  x: 0,
  y: 0,
  rotate: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  pathLength: 1,
  pathOffset: 0,
};

export type Keyframes = Partial<
  Record<Channel, readonly [number, ...number[]]>
>;

export type Track = {
  readonly frames: Keyframes;
  readonly origin: Vec;
  readonly delay: number;
  readonly feel: "ease" | "spring";
};

export type MotionOrder = {
  readonly by: "radius" | "polarAngle" | "fillDir" | "reading" | "depth";
  readonly keys: readonly PartKey[];
};

export type MotionPlan = {
  readonly tracks: ReadonlyMap<TrackTarget, Track>;
  readonly duration: number;
  readonly order?: MotionOrder;
};

export type Evidence = {
  readonly weight: number;
  readonly parts: readonly PartKey[];
  readonly stat: string;
  readonly therefore: string;
  readonly says: string;
};

export type Casting = {
  readonly patternId: AnimationPatternId;
  readonly fit: number;
  readonly evidence: readonly Evidence[];
  readonly plan: MotionPlan;
};

type Draft = {
  readonly weight: number;
  readonly parts: readonly PartKey[];
  readonly stat: string;
  readonly therefore: string;
};

type Recipe<N extends FeatureName = FeatureName> = {
  readonly needs: readonly N[];
  readonly cast: (
    features: Pick<FeatureSet, N>,
    frame: Frame
  ) => { evidence: Draft[]; plan: MotionPlan };
};

function defineRecipe<const N extends FeatureName>(
  recipe: Recipe<N>
): Recipe<N> {
  return recipe;
}

function track(
  frames: Keyframes,
  origin: Vec,
  delay = 0,
  feel: Track["feel"] = "ease"
): Track {
  return { frames, origin, delay, feel };
}

function planOf(
  entries: readonly (readonly [TrackTarget, Track])[],
  duration: number,
  order?: MotionOrder
): MotionPlan {
  return { tracks: new Map(entries), duration, order };
}

function whole(
  _frame: Frame,
  frames: Keyframes,
  origin: Vec,
  duration: number,
  feel: Track["feel"] = "ease"
): MotionPlan {
  return planOf([["all", track(frames, origin, 0, feel)]], duration);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function staggerStep(groups: number): number {
  return clamp(0.48 / Math.max(groups, 1), 0.04, 0.12);
}

function orderedTracks(
  keys: readonly PartKey[],
  frames: Keyframes,
  origin: Vec,
  step: number,
  feel: Track["feel"] = "ease"
): (readonly [TrackTarget, Track])[] {
  return keys.map((key, index) => [
    key,
    track(frames, origin, index * step, feel),
  ]);
}

function contentAspect(frame: Frame): number {
  const w = boxWidth(frame.content);
  const h = boxHeight(frame.content);
  const a = Math.max(w, h);
  const b = Math.min(w, h);
  return b < 1e-6 ? a : a / b;
}

function netDir(features: Pick<FeatureSet, "arrows">): Vec {
  const sum = features.arrows.reduce(
    (acc, arrow) => add(acc, arrow.dir),
    vec(0, 0)
  );
  const n = unit(sum);
  return len(n) < 0.2 ? vec(0, -1) : n;
}

const RECIPES: { readonly [P in AnimationPatternId]: Recipe } = {
  "rotate-wiggle": defineRecipe({
    needs: ["silhouette", "cross", "radial"],
    cast: (f, frame) => {
      const evidence: Draft[] = [
        {
          weight: 1,
          parts: [],
          stat: "no stronger structure claimed this motion",
          therefore: "a small shake still reads as attention",
        },
      ];
      const sil = f.silhouette;
      let origin = frame.center;
      const entries: (readonly [TrackTarget, Track])[] = [];
      if (sil?.pendant) {
        origin = sil.hangPoint;
        evidence.push({
          weight: 4,
          parts: [sil.body, sil.pendant],
          stat: `a clapper hangs under the body on its axis at ${fmtVec(sil.hangPoint)}`,
          therefore: "the body swings from that hang point",
        });
        entries.push([
          sil.pendant,
          track({ rotate: [0, 6, -6, 0] }, origin, 0.05),
        ]);
      }
      if (sil && sil.bilateral > 0.9 && sil.taper < 0.8) {
        origin = sil.hangPoint;
        evidence.push({
          weight: 3,
          parts: [sil.body],
          stat: `mirror-symmetric body narrowing to an apex at ${fmtVec(sil.hangPoint)}`,
          therefore: "it wiggles from the top like a bell",
        });
      }
      if (sil && sil.flankers.length >= 2) {
        evidence.push({
          weight: 3,
          parts: sil.flankers,
          stat: "mirrored marks sit beside the body",
          therefore: "they read as ringing",
        });
      }
      if (f.cross) {
        origin = f.cross.center;
        evidence.push({
          weight: 3,
          parts: f.cross.arms,
          stat: `two equal arms cross at ${fmtVec(f.cross.center)}`,
          therefore: "a quarter-turn wiggle reads well",
        });
      }
      if (sil && sil.lobes >= 5) {
        evidence.push({
          weight: 2,
          parts: [sil.body],
          stat: `${sil.lobes}-fold outline`,
          therefore: "a small rotation lands on a similar pose",
        });
      }
      entries.unshift(["all", track({ rotate: [0, -10, 10, -6, 0] }, origin)]);
      return { evidence, plan: planOf(entries, 0.7) };
    },
  }),
  "scale-pulse": defineRecipe({
    needs: ["silhouette"],
    cast: (f, frame) => {
      const evidence: Draft[] = [
        {
          weight: 1,
          parts: [],
          stat: "the icon has a measurable centroid",
          therefore: "a gentle pulse is a safe fallback",
        },
      ];
      const sil = f.silhouette;
      const origin = sil?.centroid ?? frame.center;
      const aspect = contentAspect(frame);
      let amp = 1.08;
      if (sil && sil.compactness > 0.6) {
        evidence.push({
          weight: 3,
          parts: [sil.body],
          stat: `one compact closed shape (compactness ${fmt(sil.compactness)})`,
          therefore: "it can pulse from its centroid",
        });
      }
      if (aspect > 1.3) {
        amp = 1.05;
      }
      if (aspect > 1.6) {
        evidence.push({
          weight: -2,
          parts: [],
          stat: `content aspect ${fmt(aspect)} is wide`,
          therefore: "scaling would distort the silhouette",
        });
      }
      return {
        evidence,
        plan: whole(frame, { scale: [1, amp, 1] }, origin, 0.55),
      };
    },
  }),
  "directional-nudge": defineRecipe({
    needs: ["arrows", "corners"],
    cast: (f, frame) => {
      const evidence: Draft[] = [];
      if (f.arrows.length === 0) {
        return {
          evidence: [
            {
              weight: 0,
              parts: [],
              stat: "no chevron with a travel axis",
              therefore: "the whole icon nudges up as a fallback",
            },
          ],
          plan: whole(frame, { y: [0, -2] }, frame.center, 0.5, "spring"),
        };
      }
      const net = netDir(f);
      if (
        len(f.arrows.reduce((acc, a) => add(acc, a.dir), vec(0, 0))) < 0.5 &&
        f.arrows.length >= 2
      ) {
        evidence.push({
          weight: -4,
          parts: f.arrows.map((a) => a.head),
          stat: "arrows point opposite ways",
          therefore: "there is no single travel axis",
        });
      } else {
        evidence.push({
          weight: 6,
          parts: f.arrows.map((a) => a.head),
          stat: `chevron apex ${fmtVec(f.arrows[0].tip)} and shaft point ${fmtVec(net)}`,
          therefore: `the arrow travels ${fmt(0.08 * frame.size)} units along that axis`,
        });
      }
      const amp = 0.08 * frame.size;
      const entries: (readonly [TrackTarget, Track])[] = [];
      for (const arrow of f.arrows) {
        const frames = {
          x: [0, net.x * amp] as [number, number],
          y: [0, net.y * amp] as [number, number],
        };
        entries.push([arrow.head, track(frames, arrow.tip, 0, "spring")]);
        if (arrow.shaft) {
          entries.push([arrow.shaft, track(frames, arrow.tip, 0, "spring")]);
        }
        if (arrow.base) {
          evidence.push({
            weight: 2,
            parts: [arrow.base],
            stat: "a base sits on the tail side",
            therefore: "the tray stays put while the arrow lifts",
          });
        }
      }
      return { evidence, plan: planOf(entries, 0.5) };
    },
  }),
  "path-morph": defineRecipe({
    needs: ["arrows"],
    cast: (f, frame) => {
      const split = f.arrows.filter((a) => a.shaft);
      if (split.length !== 1) {
        const dir = f.arrows[0]?.dir ?? vec(0, -1);
        return {
          evidence: [
            {
              weight: split.length === 0 ? 0 : 2,
              parts: f.arrows.map((a) => a.head),
              stat:
                split.length === 0
                  ? "head and shaft are not separate parts"
                  : "more than one split arrow",
              therefore: "a small travel along the axis is the fallback",
            },
          ],
          plan: whole(
            frame,
            { x: [0, dir.x * 1.5, 0], y: [0, dir.y * 1.5, 0] },
            frame.center,
            0.55
          ),
        };
      }
      const arrow = split[0];
      const evidence: Draft[] = [
        {
          weight: 5,
          parts: [arrow.head, arrow.shaft as PartKey],
          stat: "head and shaft are separate parts",
          therefore: "the head can lead while the shaft stretches",
        },
      ];
      if (arrow.base) {
        evidence.push({
          weight: -2,
          parts: [arrow.base],
          stat: "a tray sits under the arrow",
          therefore: "morphing the arrow fights the base",
        });
      }
      const shaft = byKey(frame, arrow.shaft as PartKey);
      const tail =
        shaft?.ends &&
        dist(shaft.ends.start.at, arrow.tip) >
          dist(shaft.ends.end.at, arrow.tip)
          ? shaft.ends.start.at
          : (shaft?.ends?.end.at ?? arrow.tip);
      const vertical = Math.abs(arrow.dir.y) >= Math.abs(arrow.dir.x);
      const entries: (readonly [TrackTarget, Track])[] = [
        [
          arrow.head,
          track(
            { x: [0, arrow.dir.x * 1.5, 0], y: [0, arrow.dir.y * 1.5, 0] },
            arrow.tip
          ),
        ],
      ];
      if (arrow.shaft) {
        entries.push([
          arrow.shaft,
          track(
            vertical ? { scaleY: [1, 1.15, 1] } : { scaleX: [1, 1.15, 1] },
            tail
          ),
        ]);
      }
      return { evidence, plan: planOf(entries, 0.55) };
    },
  }),
  "stagger-fade": defineRecipe({
    needs: ["radial", "concentric", "lattice", "bars"],
    cast: (f, frame) => {
      const opacity: Keyframes = { opacity: [1, 0.25, 1] };
      if (f.concentric && f.concentric.arcs.length >= 2) {
        const keys = f.concentric.arcs.map((a) => a.key);
        const step = staggerStep(keys.length);
        const evidence: Draft[] = [
          {
            weight: 7,
            parts: keys,
            stat: `${keys.length} open arcs share ${fmtVec(f.concentric.center)} at radii ${f.concentric.arcs.map((a) => fmt(a.r)).join("/")}`,
            therefore: "they fade in from the inside out",
          },
        ];
        return {
          evidence,
          plan: planOf(
            orderedTracks(keys, opacity, f.concentric.center, step),
            0.7,
            { by: "radius", keys }
          ),
        };
      }
      if (f.radial && !f.radial.attached) {
        const keys = f.radial.rays;
        const step = staggerStep(keys.length);
        return {
          evidence: [
            {
              weight: 7,
              parts: keys,
              stat: `${keys.length} detached rays at ${fmt(f.radial.stepDeg)}° steps around ${fmtVec(f.radial.center)}`,
              therefore: "they fade clockwise from the top",
            },
          ],
          plan: planOf(
            orderedTracks(keys, opacity, f.radial.center, step),
            0.7,
            {
              by: "polarAngle",
              keys,
            }
          ),
        };
      }
      if (f.lattice) {
        const keys = f.lattice.marks;
        const step = staggerStep(keys.length);
        return {
          evidence: [
            {
              weight: 6,
              parts: keys,
              stat: `${keys.length} marks on a ${f.lattice.rows}×${f.lattice.cols} lattice`,
              therefore: "they fade in reading order",
            },
          ],
          plan: planOf(orderedTracks(keys, opacity, frame.center, step), 0.7, {
            by: "reading",
            keys,
          }),
        };
      }
      if (f.bars) {
        const keys = f.bars.bars;
        const step = staggerStep(keys.length);
        return {
          evidence: [
            {
              weight: 3,
              parts: keys,
              stat: `${keys.length} parallel bars`,
              therefore: "they fade along the fill direction",
            },
          ],
          plan: planOf(orderedTracks(keys, opacity, frame.center, step), 0.7, {
            by: "fillDir",
            keys,
          }),
        };
      }
      if (f.radial) {
        const keys = f.radial.rays;
        const step = staggerStep(keys.length);
        return {
          evidence: [
            {
              weight: 3,
              parts: keys,
              stat: `${keys.length} rays around ${fmtVec(f.radial.center)}`,
              therefore: "they can still fade in sequence",
            },
          ],
          plan: planOf(
            orderedTracks(keys, opacity, f.radial.center, step),
            0.7,
            {
              by: "polarAngle",
              keys,
            }
          ),
        };
      }
      return {
        evidence: [
          {
            weight: 0,
            parts: [],
            stat: "nothing repeats to stagger",
            therefore: "the whole icon fades once as a fallback",
          },
        ],
        plan: whole(frame, opacity, frame.center, 0.6),
      };
    },
  }),
  "corner-explode": defineRecipe({
    needs: ["corners"],
    cast: (f, frame) => {
      if (!f.corners) {
        return {
          evidence: [
            {
              weight: 0,
              parts: [],
              stat: "no four-corner structure",
              therefore: "the whole icon eases outward as a fallback",
            },
          ],
          plan: whole(frame, { scale: [1, 1.06, 1] }, frame.center, 0.55),
        };
      }
      const sign = f.corners.facing === "out" ? 1 : -1;
      const amp = 0.06 * frame.size;
      const entries: (readonly [TrackTarget, Track])[] = [];
      for (const corner of f.corners.corners) {
        const frames = {
          x: [0, corner.out.x * sign * amp, 0] as [number, number, number],
          y: [0, corner.out.y * sign * amp, 0] as [number, number, number],
        };
        for (const key of corner.keys) {
          entries.push([key, track(frames, corner.vertex)]);
        }
      }
      return {
        evidence: [
          {
            weight: 8,
            parts: f.corners.corners.flatMap((c) => [...c.keys]),
            stat: `four marks sit in four quadrants and face ${f.corners.facing}`,
            therefore: "each moves along its own diagonal",
          },
        ],
        plan: planOf(entries, 0.55),
      };
    },
  }),
  "peel-layers": defineRecipe({
    needs: ["stack"],
    cast: (f, frame) => {
      if (!f.stack) {
        return {
          evidence: [
            {
              weight: 0,
              parts: [],
              stat: "no translated sheets",
              therefore: "the whole icon shifts as a fallback",
            },
          ],
          plan: whole(frame, { x: [0, 1.5], y: [0, -1.5] }, frame.center, 0.55),
        };
      }
      const dir = unit(f.stack.step);
      const front = lastOfKeys(f.stack.layers);
      const entries: (readonly [TrackTarget, Track])[] = [];
      const keys = f.stack.layers;
      for (const [index, key] of keys.entries()) {
        const depth = keys.length - 1 - index;
        const mag = key === front ? -0.5 : depth * 1.5;
        entries.push([
          key,
          track(
            { x: [0, dir.x * mag], y: [0, dir.y * mag] },
            frame.center,
            depth * 0.04
          ),
        ]);
      }
      return {
        evidence: [
          {
            weight: 7,
            parts: keys,
            stat: `${keys.length} sheets, the back outline shifted by ${fmtVec(f.stack.step)}`,
            therefore: "the stack peels apart along that offset",
          },
        ],
        plan: planOf(entries, 0.6, { by: "depth", keys }),
      };
    },
  }),
  "pivot-rotate": defineRecipe({
    needs: ["hands", "radial", "silhouette"],
    cast: (f, frame) => {
      if (f.hands) {
        const evidence: Draft[] = [
          {
            weight: 7,
            parts: f.hands.hands,
            stat: `the hand path bends at the dial center ${fmtVec(f.hands.pivot)}`,
            therefore: "it sweeps around that point",
          },
        ];
        if (f.silhouette?.flankers.length) {
          evidence.push({
            weight: -3,
            parts: f.silhouette.flankers,
            stat: "bells sit around the dial",
            therefore: "ringing reads louder than ticking",
          });
        }
        return {
          evidence,
          plan: planOf(
            f.hands.hands.map((key) => [
              key,
              track({ rotate: [0, 360] }, f.hands?.pivot ?? frame.center),
            ]),
            1.2
          ),
        };
      }
      if (f.radial?.attached) {
        return {
          evidence: [
            {
              weight: 6,
              parts: f.radial.rays,
              stat: `spokes attach to a hub at ${fmtVec(f.radial.center)}`,
              therefore: `the wheel turns ${fmt(f.radial.stepDeg)}° and lands on an identical pose`,
            },
          ],
          plan: whole(
            frame,
            { rotate: [0, f.radial.stepDeg] },
            f.radial.center,
            0.8
          ),
        };
      }
      if (f.silhouette && f.silhouette.lobes >= 6) {
        const step = 360 / f.silhouette.lobes;
        return {
          evidence: [
            {
              weight: 5,
              parts: [f.silhouette.body],
              stat: `${f.silhouette.lobes}-fold gear outline`,
              therefore: `rotating ${fmt(step)}° lands on the same silhouette`,
            },
          ],
          plan: whole(frame, { rotate: [0, step] }, f.silhouette.centroid, 0.8),
        };
      }
      if (f.radial && !f.radial.attached) {
        return {
          evidence: [
            {
              weight: 3,
              parts: f.radial.rays,
              stat: `${f.radial.rays.length} rays around ${fmtVec(f.radial.center)}`,
              therefore: `they turn ${fmt(f.radial.stepDeg)}° as one`,
            },
          ],
          plan: whole(
            frame,
            { rotate: [0, f.radial.stepDeg] },
            f.radial.center,
            0.8
          ),
        };
      }
      return {
        evidence: [
          {
            weight: 0,
            parts: [],
            stat: "no dial or wheel",
            therefore: "the whole icon rotates a little as a fallback",
          },
        ],
        plan: whole(frame, { rotate: [0, 30] }, frame.center, 0.8),
      };
    },
  }),
  "fill-grow": defineRecipe({
    needs: ["gauge", "bars", "concentric"],
    cast: (f, frame) => {
      const evidence: Draft[] = [];
      if (f.gauge) {
        evidence.push({
          weight: 5,
          parts: [f.gauge.cell, f.gauge.terminal],
          stat: "a terminal sits on one short side of the cell",
          therefore: "fill grows toward that terminal",
        });
      }
      if (f.bars) {
        if (f.gauge && f.bars.cell === f.gauge.cell) {
          evidence.push({
            weight: 4,
            parts: f.bars.bars,
            stat: `${f.bars.bars.length} bars sit inside the cell`,
            therefore: "they refill along the cell",
          });
        }
        if (f.bars.sharedBaseline) {
          evidence.push({
            weight: 5,
            parts: f.bars.bars,
            stat: "bars share a baseline",
            therefore: "they grow from that edge",
          });
        }
        if (f.bars.monotonic) {
          evidence.push({
            weight: 2,
            parts: f.bars.bars,
            stat: "bar lengths rise",
            therefore: "the sequence reads as a level",
          });
        }
      }
      if (f.concentric && !f.bars) {
        evidence.push({
          weight: 2,
          parts: f.concentric.arcs.map((a) => a.key),
          stat: "nested arcs can read as level",
          therefore: "they grow from the center outward",
        });
      }
      if (!f.bars) {
        return {
          evidence: evidence.length
            ? evidence
            : [
                {
                  weight: 0,
                  parts: [],
                  stat: "no bars to fill",
                  therefore: "the whole icon scales in x as a fallback",
                },
              ],
          plan: whole(frame, { scaleX: [0, 1] }, frame.center, 0.6),
        };
      }
      const entries: (readonly [TrackTarget, Track])[] = [];
      for (const [index, key] of f.bars.bars.entries()) {
        const origin = f.bars.roots.get(key) ?? frame.center;
        const vertical =
          Math.abs(f.bars.growDir.y) >= Math.abs(f.bars.growDir.x);
        entries.push([
          key,
          track(
            vertical ? { scaleY: [0, 1] } : { scaleX: [0, 1] },
            origin,
            index * 0.08
          ),
        ]);
      }
      return {
        evidence,
        plan: planOf(entries, 0.6, { by: "fillDir", keys: f.bars.bars }),
      };
    },
  }),
  "semantic-path-length": defineRecipe({
    needs: ["shackle", "checks"],
    cast: (f, frame) => {
      const evidence: Draft[] = [];
      const entries: (readonly [TrackTarget, Track])[] = [];
      if (f.shackle) {
        evidence.push({
          weight: 6,
          parts: [f.shackle.shackle],
          stat: `U-stroke ${f.shackle.endsOnBody === 2 ? "ends on" : "leaves"} the body's top edge`,
          therefore: "only the shackle draws",
        });
        entries.push([
          f.shackle.shackle,
          track({ pathLength: [0, 1] }, frame.center),
        ]);
      }
      for (const [index, mark] of f.checks.entries()) {
        evidence.push({
          weight: Math.min(6, 8 - index * 2),
          parts: [mark.key],
          stat: mark.reversed
            ? `the check's path starts at the long leg's tip at ${fmtVec(mark.vertex)}`
            : `a check bends at ${fmtVec(mark.vertex)}`,
          therefore: mark.reversed
            ? "it draws in reverse to be written from the short leg"
            : "it draws from the short leg",
        });
        const frames: Keyframes = mark.reversed
          ? { pathLength: [0, 1], pathOffset: [1, 0] }
          : { pathLength: [0, 1] };
        entries.push([mark.key, track(frames, mark.vertex, index * 0.15)]);
      }
      if (entries.length === 0) {
        return {
          evidence: [
            {
              weight: 0,
              parts: [],
              stat: "no shackle or check",
              therefore: "the whole icon draws as a fallback",
            },
          ],
          plan: whole(frame, { pathLength: [0, 1] }, frame.center, 0.6),
        };
      }
      return { evidence, plan: planOf(entries, 0.6) };
    },
  }),
  "search-bounce": defineRecipe({
    needs: ["loupe"],
    cast: (f, frame) => {
      if (!f.loupe) {
        return {
          evidence: [
            {
              weight: 0,
              parts: [],
              stat: "no lens and handle",
              therefore: "the whole icon orbits as a fallback",
            },
          ],
          plan: whole(
            frame,
            { x: [0, 1, -1, 0], y: [0, -1, 1, 0] },
            frame.center,
            0.7
          ),
        };
      }
      const r = 0.05 * frame.size;
      const u = scale(f.loupe.handleDir, -1);
      const p = vec(-u.y, u.x);
      return {
        evidence: [
          {
            weight: 7,
            parts: [f.loupe.lens, f.loupe.handle],
            stat: `a handle leaves the r${fmt(f.loupe.r)} lens radially at ${fmtVec(f.loupe.grip)}`,
            therefore: "it scans in a small orbit lens-first",
          },
        ],
        plan: whole(
          frame,
          {
            x: [0, r * u.x, r * p.x, -r * u.x, -r * p.x, 0],
            y: [0, r * u.y, r * p.y, -r * u.y, -r * p.y, 0],
          },
          f.loupe.center,
          0.8
        ),
      };
    },
  }),
  "face-morph": defineRecipe({
    needs: ["face"],
    cast: (f, frame) => {
      if (!f.face) {
        return {
          evidence: [
            {
              weight: 0,
              parts: [],
              stat: "no face",
              therefore: "the whole icon pulses as a fallback",
            },
          ],
          plan: whole(frame, { scale: [1, 1.05, 1] }, frame.center, 0.6),
        };
      }
      const mouth = byKey(frame, f.face.mouth);
      const mouthOrigin = mouth
        ? vec(f.face.mouthCenter.x, mouth.bbox.minY)
        : f.face.mouthCenter;
      const mouthFrames: Keyframes =
        f.face.mood === "smile"
          ? { scale: [1, 1.12, 1] }
          : f.face.mood === "frown"
            ? { y: [0, 0.6, 0] }
            : f.face.mood === "flat"
              ? { scaleX: [1, 1.2, 1] }
              : { scale: [1, 1.08, 1] };
      const entries: (readonly [TrackTarget, Track])[] = [
        [f.face.eyes[0], track({ scaleY: [1, 0.15, 1] }, f.face.eyeCenters[0])],
        [f.face.eyes[1], track({ scaleY: [1, 0.15, 1] }, f.face.eyeCenters[1])],
        [f.face.mouth, track(mouthFrames, mouthOrigin)],
      ];
      for (const brow of f.face.brows) {
        entries.push([brow, track({ y: [0, -0.8, 0] }, frame.center, 0.05)]);
      }
      return {
        evidence: [
          {
            weight: 8,
            parts: [f.face.outline, ...f.face.eyes, f.face.mouth],
            stat: `two mirrored marks and a ${f.face.mood} mouth inside the outline`,
            therefore: "eyes blink and the mouth shifts",
          },
        ],
        plan: planOf(entries, 0.7),
      };
    },
  }),
};

function lastOfKeys(keys: readonly PartKey[]): PartKey {
  return keys.at(-1) as PartKey;
}

type Veto = {
  readonly pattern: AnimationPatternId;
  readonly feature: FeatureName;
  readonly weight: number;
  readonly stat: string;
  readonly therefore: string;
};

const VETOES: readonly Veto[] = [
  {
    pattern: "scale-pulse",
    feature: "hands",
    weight: -4,
    stat: "a hand pivots inside the dial",
    therefore: "pulsing the whole icon hides the motion that matters",
  },
  {
    pattern: "scale-pulse",
    feature: "arrows",
    weight: -4,
    stat: "the icon has a travel axis",
    therefore: "pulsing the whole icon hides the motion that matters",
  },
  {
    pattern: "scale-pulse",
    feature: "face",
    weight: -4,
    stat: "eyes and a mouth are already a face",
    therefore: "pulsing the whole icon hides the motion that matters",
  },
  {
    pattern: "scale-pulse",
    feature: "radial",
    weight: -4,
    stat: "repeated rays should stagger, not pulse",
    therefore: "pulsing the whole icon hides the motion that matters",
  },
  {
    pattern: "scale-pulse",
    feature: "bars",
    weight: -4,
    stat: "bars read as a level",
    therefore: "pulsing the whole icon hides the motion that matters",
  },
  {
    pattern: "directional-nudge",
    feature: "corners",
    weight: -4,
    stat: "four corners have no single travel axis",
    therefore: "nudging one way fights the frame",
  },
  {
    pattern: "directional-nudge",
    feature: "hands",
    weight: -4,
    stat: "a hand pivots inside the dial",
    therefore: "sliding along a chevron fights the sweep",
  },
];

function featurePresent(features: FeatureSet, name: FeatureName): boolean {
  const value = features[name];
  return Array.isArray(value) ? value.length > 0 : value !== undefined;
}

function featureParts(features: FeatureSet, name: FeatureName): PartKey[] {
  const bound = boundKeys(features)[name];
  return (bound ?? []) as PartKey[];
}

function vetoesFor(pattern: AnimationPatternId, features: FeatureSet): Draft[] {
  return VETOES.filter(
    (veto) => veto.pattern === pattern && featurePresent(features, veto.feature)
  ).map((veto) => ({
    weight: veto.weight,
    parts: featureParts(features, veto.feature),
    stat: veto.stat,
    therefore: veto.therefore,
  }));
}

export function makeCasting(
  patternId: AnimationPatternId,
  evidence: readonly Draft[],
  plan: MotionPlan
): Casting {
  const withSays: Evidence[] = evidence.map((item) => ({
    ...item,
    says: `${item.stat}, so ${item.therefore}`,
  }));
  return {
    patternId,
    fit: withSays.reduce((sum, item) => sum + item.weight, 0),
    evidence: withSays,
    plan,
  };
}

export function castAll(
  features: FeatureSet,
  frame: Frame
): Record<AnimationPatternId, Casting> {
  const result = {} as Record<AnimationPatternId, Casting>;
  for (const pattern of ANIMATION_PATTERNS) {
    const { evidence, plan } = RECIPES[pattern.id].cast(features, frame);
    result[pattern.id] = makeCasting(
      pattern.id,
      [...evidence, ...vetoesFor(pattern.id, features)],
      plan
    );
  }
  return result;
}

export function rank(
  castings: Record<AnimationPatternId, Casting>
): AnimationPatternId[] {
  return ANIMATION_PATTERNS.map((pattern) => pattern.id).sort((a, b) => {
    const gap = castings[b].fit - castings[a].fit;
    if (gap !== 0) {
      return gap;
    }
    return (
      ANIMATION_PATTERNS.findIndex((p) => p.id === a) -
      ANIMATION_PATTERNS.findIndex((p) => p.id === b)
    );
  });
}

export function summarize(frame: Frame, features: FeatureSet): string {
  return sceneSummary(frame, features);
}

export { VETOES };
