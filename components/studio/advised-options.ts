import {
  ANIMATION_PATTERN_BY_ID,
  type AnimationPatternId,
} from "@/lib/animation-patterns";
import type { AdvisedOption } from "@/lib/cursor-suggest";
import type { AnimationSuggestion } from "@/lib/suggest-animation";

export type StudioOption = {
  patternId: AnimationPatternId;
  rationale: string;
  advice: string | null;
  cursorRank: number | null;
};

export function mergeAdvice(
  suggestions: AnimationSuggestion[],
  advised: AdvisedOption[] | null
): StudioOption[] {
  const byPattern = new Map(
    (advised ?? []).map((option, index) => [
      option.patternId,
      { advice: option.advice, rank: index + 1 },
    ])
  );
  const options: StudioOption[] = suggestions.map((s) => ({
    patternId: s.patternId,
    rationale: s.rationale,
    advice: byPattern.get(s.patternId)?.advice ?? null,
    cursorRank: byPattern.get(s.patternId)?.rank ?? null,
  }));
  const shown = new Set(options.map((o) => o.patternId));
  for (const [patternId, { advice, rank }] of byPattern) {
    if (!shown.has(patternId)) {
      options.push({
        patternId,
        rationale: ANIMATION_PATTERN_BY_ID[patternId].when,
        advice,
        cursorRank: rank,
      });
    }
  }
  return options;
}
