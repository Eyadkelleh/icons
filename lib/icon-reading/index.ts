// The public API is this one module. Internals import relatively, never through this file.
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
