import { describe, detectFeatures } from "./features";
import { measureFrame } from "./geometry";
import { parseSvg } from "./parse";
import { castAll, rank, summarize } from "./recipes";

export type { FeatureSet } from "./features";
// biome-ignore lint/performance/noBarrelFile: single public entry by design
export {
  type Box,
  type End,
  type Frame,
  frameOf,
  measureFrame,
  measureParts,
  type Part,
  type Vertex,
} from "./geometry";
export {
  asPartKey,
  IconReadError,
  MAX_SVG_BYTES,
  type PartKey,
  parseSvg,
  SVG_TAGS,
  type SvgNode,
  type SvgTag,
} from "./parse";
export type { ArcFit, Run, Vec } from "./path-data";
export {
  type Casting,
  type Channel,
  type Evidence,
  type Keyframes,
  type MotionOrder,
  type MotionPlan,
  REST_POSE,
  type Track,
  type TrackTarget,
  type WholeIcon,
} from "./recipes";

export type IconReading = {
  readonly tree: ReturnType<typeof parseSvg>;
  readonly castings: ReturnType<typeof castAll>;
  readonly ranking: ReturnType<typeof rank>;
  readonly facts: readonly string[];
  readonly summary: string;
};

export function readIcon(markup: string): IconReading {
  const tree = parseSvg(markup);
  const frame = measureFrame(tree);
  const features = detectFeatures(frame);
  const castings = castAll(features, frame);
  return {
    tree,
    castings,
    ranking: rank(castings),
    facts: describe(features, frame),
    summary: summarize(frame, features),
  };
}
