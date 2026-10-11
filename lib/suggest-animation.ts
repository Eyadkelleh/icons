import {
  ANIMATION_PATTERN_BY_ID,
  ANIMATION_PATTERNS,
  type AnimationPatternId,
} from "@/lib/animation-patterns";
import type { SvgAnalysis, SvgShapeGuess } from "@/lib/svg-analyze";

export type AnimationSuggestion = {
  patternId: AnimationPatternId;
  score: number;
  rationale: string;
};

const SHAPE_AFFINITY: Record<
  SvgShapeGuess,
  Partial<Record<AnimationPatternId, number>>
> = {
  arrow: { "directional-nudge": 10, "path-morph": 8, "search-bounce": 2 },
  rays: { "stagger-fade": 10, "rotate-wiggle": 4, "scale-pulse": 3 },
  rings: { "stagger-fade": 9, "scale-pulse": 4 },
  bars: { "fill-grow": 9, "stagger-fade": 7 },
  face: { "face-morph": 10, "scale-pulse": 6, "rotate-wiggle": 3 },
  lock: { "semantic-path-length": 9, "rotate-wiggle": 4 },
  corners: { "corner-explode": 10, "scale-pulse": 3 },
  layers: { "peel-layers": 9, "stagger-fade": 4 },
  gauge: { "fill-grow": 10, "pivot-rotate": 4 },
  search: { "search-bounce": 10, "rotate-wiggle": 3 },
  generic: { "scale-pulse": 5, "rotate-wiggle": 5, "directional-nudge": 2 },
};

const BASELINE: Partial<Record<AnimationPatternId, number>> = {
  "scale-pulse": 1,
  "rotate-wiggle": 1,
};

function shapesFor(
  patternId: AnimationPatternId,
  guesses: SvgShapeGuess[]
): SvgShapeGuess[] {
  return guesses.filter((shape) => (SHAPE_AFFINITY[shape][patternId] ?? 0) > 0);
}

export function suggestAnimations(
  analysis: SvgAnalysis,
  limit = 5
): AnimationSuggestion[] {
  const scored = ANIMATION_PATTERNS.map((pattern) => {
    const fromShapes = analysis.shapeGuesses.reduce(
      (sum, shape) => sum + (SHAPE_AFFINITY[shape][pattern.id] ?? 0),
      0
    );
    const score = fromShapes + (BASELINE[pattern.id] ?? 0);
    const reasons = shapesFor(pattern.id, analysis.shapeGuesses);
    const rationale = reasons.length
      ? `Looks like ${reasons.join(" + ")}. ${pattern.when}`
      : `Neutral fallback. ${pattern.when}`;
    return { patternId: pattern.id, score, rationale };
  });

  return scored
    .filter((suggestion) => suggestion.score > 0)
    .sort((a, b) => b.score - a.score || a.patternId.localeCompare(b.patternId))
    .slice(0, limit);
}

export function suggestionSpread(suggestions: AnimationSuggestion[]): number {
  if (suggestions.length < 2) {
    return 100;
  }
  return suggestions[0].score - suggestions[1].score;
}

export function patternTitle(patternId: AnimationPatternId): string {
  return ANIMATION_PATTERN_BY_ID[patternId].title;
}
