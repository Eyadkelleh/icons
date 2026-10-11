import type { Variants } from "motion/react";

export type AnimationPatternId =
  | "rotate-wiggle"
  | "scale-pulse"
  | "directional-nudge"
  | "path-morph"
  | "stagger-fade"
  | "corner-explode"
  | "peel-layers"
  | "pivot-rotate"
  | "fill-grow"
  | "semantic-path-length"
  | "search-bounce"
  | "face-morph";

export type AnimationPattern = {
  id: AnimationPatternId;
  title: string;
  when: string;
  avoid: string;
  exampleIcons: string[];
  variants: Variants;
  target: "svg" | "group" | "paths" | "layers";
};

/**
 * Catalog of purposeful Motion patterns mined from lucide-animated icons.
 * Naive whole-icon pathLength "draw" is intentionally not a default pattern.
 */
export const ANIMATION_PATTERNS: AnimationPattern[] = [
  {
    id: "rotate-wiggle",
    title: "Rotate wiggle",
    when: "Single dominant glyph that benefits from attention shake (bell, alert, plus).",
    avoid:
      "Multi-part diagrams or directional arrows where rotation fights meaning.",
    exampleIcons: ["bell", "plus", "cog"],
    target: "svg",
    variants: {
      normal: { rotate: 0 },
      animate: { rotate: [0, -10, 10, -10, 0] },
    },
  },
  {
    id: "scale-pulse",
    title: "Scale pulse",
    when: "Compact filled or closed shapes that read as favorited or alive (heart, smile).",
    avoid: "Wide landscapes or long arrows where scaling distorts silhouette.",
    exampleIcons: ["heart", "smile"],
    target: "svg",
    variants: {
      normal: { scale: 1 },
      animate: { scale: [1, 1.08, 1] },
    },
  },
  {
    id: "directional-nudge",
    title: "Directional nudge",
    when: "Clear up/down/left/right affordance (upload, download, cloud-upload).",
    avoid: "Symmetric badges with no travel axis.",
    exampleIcons: ["upload", "download", "cloud-upload"],
    target: "group",
    variants: {
      normal: { y: 0 },
      animate: {
        y: -2,
        transition: { type: "spring", stiffness: 200, damping: 10 },
      },
    },
  },
  {
    id: "path-morph",
    title: "Path morph",
    when: "Arrow heads or chevrons that can morph `d` while translating along the axis.",
    avoid: "Filled pictograms without a meaningful alternate path.",
    exampleIcons: ["arrow-up", "arrow-down", "square-arrow-up"],
    target: "paths",
    variants: {
      normal: { y: 0 },
      animate: { y: [-1, 1, -1] },
    },
  },
  {
    id: "stagger-fade",
    title: "Stagger fade",
    when: "Repeated rays, rings, bars, or dots that should enter in sequence (sun, wifi, grip).",
    avoid: "Single-path icons with nothing to stagger.",
    exampleIcons: ["sun", "wifi", "grip"],
    target: "paths",
    variants: {
      normal: { opacity: 1 },
      animate: { opacity: [1, 0.35, 1] },
    },
  },
  {
    id: "corner-explode",
    title: "Corner explode",
    when: "Four corner marks or expand/maximize frames that move outward.",
    avoid: "Icons without corner structure.",
    exampleIcons: ["maximize", "expand", "minimize"],
    target: "paths",
    variants: {
      normal: { x: 0, y: 0 },
      animate: { x: [0, 1.5], y: [0, 1.5] },
    },
  },
  {
    id: "peel-layers",
    title: "Peel layers",
    when: "Stacked sheets or duplicate outlines (copy, file-stack, square-stack).",
    avoid: "Flat single-layer glyphs.",
    exampleIcons: ["copy", "file-stack", "square-stack"],
    target: "layers",
    variants: {
      normal: { x: 0, y: 0 },
      animate: { x: 1.5, y: -1.5 },
    },
  },
  {
    id: "pivot-rotate",
    title: "Pivot rotate",
    when: "Hands or levers that should rotate around a fixed origin (clock, history, timer).",
    avoid: "Icons without a natural pivot point.",
    exampleIcons: ["clock", "history", "timer"],
    target: "group",
    variants: {
      normal: { rotate: 0 },
      animate: { rotate: 30 },
    },
  },
  {
    id: "fill-grow",
    title: "Fill grow",
    when: "Level indicators (battery bars, progress) that grow fill or width.",
    avoid: "Stroke-only icons with no capacity metaphor.",
    exampleIcons: ["battery", "battery-full", "battery-medium"],
    target: "paths",
    variants: {
      normal: { scaleX: 0.6 },
      animate: { scaleX: 1 },
    },
  },
  {
    id: "semantic-path-length",
    title: "Semantic path length",
    when: "A short stroke that means open/close or confirm (lock shackle, check mark), never a whole-icon draw.",
    avoid: "Drawing every path with strokeDashoffset as a generic reveal.",
    exampleIcons: ["check", "lock", "circle-check"],
    target: "paths",
    variants: {
      normal: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1] },
    },
  },
  {
    id: "search-bounce",
    title: "Search bounce",
    when: "Loupe or pointer that should translate in a small explore bounce.",
    avoid: "Static badges with no search metaphor.",
    exampleIcons: ["search"],
    target: "svg",
    variants: {
      normal: { x: 0, y: 0 },
      animate: { x: [0, 1, -1, 0], y: [0, -1, 1, 0] },
    },
  },
  {
    id: "face-morph",
    title: "Face morph",
    when: "Mouth or eye paths that can morph expression (smile, frown, laugh).",
    avoid: "Non-face geometry.",
    exampleIcons: ["smile", "frown", "laugh"],
    target: "paths",
    variants: {
      normal: { scale: 1 },
      animate: { scale: [1, 1.05, 1] },
    },
  },
];

export const ANIMATION_PATTERN_BY_ID = Object.fromEntries(
  ANIMATION_PATTERNS.map((pattern) => [pattern.id, pattern])
) as Record<AnimationPatternId, AnimationPattern>;

export function listAnimationPatternIds(): AnimationPatternId[] {
  return ANIMATION_PATTERNS.map((pattern) => pattern.id);
}
