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
};

/**
 * Catalog of purposeful Motion patterns mined from lucide-animated icons.
 * Naive whole-icon pathLength "draw" is intentionally not a default pattern.
 * Motion itself is computed from geometry; this file keeps copy only.
 */
export const ANIMATION_PATTERNS: AnimationPattern[] = [
  {
    id: "rotate-wiggle",
    title: "Rotate wiggle",
    when: "Single dominant glyph that benefits from attention shake (bell, alert, plus).",
    avoid:
      "Multi-part diagrams or directional arrows where rotation fights meaning.",
    exampleIcons: ["bell", "plus", "cog"],
  },
  {
    id: "scale-pulse",
    title: "Scale pulse",
    when: "Compact filled or closed shapes that read as favorited or alive (heart, smile).",
    avoid: "Wide landscapes or long arrows where scaling distorts silhouette.",
    exampleIcons: ["heart", "smile"],
  },
  {
    id: "directional-nudge",
    title: "Directional nudge",
    when: "Clear up/down/left/right affordance (upload, download, cloud-upload).",
    avoid: "Symmetric badges with no travel axis.",
    exampleIcons: ["upload", "download", "cloud-upload"],
  },
  {
    id: "path-morph",
    title: "Path morph",
    when: "Arrow heads or chevrons that can morph `d` while translating along the axis.",
    avoid: "Filled pictograms without a meaningful alternate path.",
    exampleIcons: ["arrow-up", "arrow-down", "square-arrow-up"],
  },
  {
    id: "stagger-fade",
    title: "Stagger fade",
    when: "Repeated rays, rings, bars, or dots that should enter in sequence (sun, wifi, grip).",
    avoid: "Single-path icons with nothing to stagger.",
    exampleIcons: ["sun", "wifi", "grip"],
  },
  {
    id: "corner-explode",
    title: "Corner explode",
    when: "Four corner marks or expand/maximize frames that move outward.",
    avoid: "Icons without corner structure.",
    exampleIcons: ["maximize", "expand", "minimize"],
  },
  {
    id: "peel-layers",
    title: "Peel layers",
    when: "Stacked sheets or duplicate outlines (copy, file-stack, square-stack).",
    avoid: "Flat single-layer glyphs.",
    exampleIcons: ["copy", "file-stack", "square-stack"],
  },
  {
    id: "pivot-rotate",
    title: "Pivot rotate",
    when: "Hands or levers that should rotate around a fixed origin (clock, history, timer).",
    avoid: "Icons without a natural pivot point.",
    exampleIcons: ["clock", "history", "timer"],
  },
  {
    id: "fill-grow",
    title: "Fill grow",
    when: "Level indicators (battery bars, progress) that grow fill or width.",
    avoid: "Stroke-only icons with no capacity metaphor.",
    exampleIcons: ["battery", "battery-full", "battery-medium"],
  },
  {
    id: "semantic-path-length",
    title: "Semantic path length",
    when: "A short stroke that means open/close or confirm (lock shackle, check mark), never a whole-icon draw.",
    avoid: "Drawing every path with strokeDashoffset as a generic reveal.",
    exampleIcons: ["check", "lock", "circle-check"],
  },
  {
    id: "search-bounce",
    title: "Search bounce",
    when: "Loupe or pointer that should translate in a small explore bounce.",
    avoid: "Static badges with no search metaphor.",
    exampleIcons: ["search"],
  },
  {
    id: "face-morph",
    title: "Face morph",
    when: "Mouth or eye paths that can morph expression (smile, frown, laugh).",
    avoid: "Non-face geometry.",
    exampleIcons: ["smile", "frown", "laugh"],
  },
];

export const ANIMATION_PATTERN_BY_ID = Object.fromEntries(
  ANIMATION_PATTERNS.map((pattern) => [pattern.id, pattern])
) as Record<AnimationPatternId, AnimationPattern>;

export function listAnimationPatternIds(): AnimationPatternId[] {
  return ANIMATION_PATTERNS.map((pattern) => pattern.id);
}

export function patternTitle(patternId: AnimationPatternId): string {
  return ANIMATION_PATTERN_BY_ID[patternId].title;
}
