import type { AnimationPatternId } from "@/lib/animation-patterns";
import type { AdvisedOption } from "@/lib/cursor-suggest";
import type { IconReading } from "@/lib/icon-reading";

export type StudioOption = {
  patternId: AnimationPatternId;
  rationale: string;
  advice: string | null;
  cursorRank: number | null;
};

function rationaleFor(
  reading: IconReading,
  patternId: AnimationPatternId
): string {
  const casting = reading.castings[patternId];
  const lines = casting.evidence
    .filter((item) => item.weight > 0)
    .map((item) => item.says);
  return lines.length ? lines.join(" ") : (casting.evidence[0]?.says ?? "");
}

export function mergeAdvice(
  reading: IconReading,
  advised: AdvisedOption[] | null
): StudioOption[] {
  const byPattern = new Map(
    (advised ?? []).map((option, index) => [
      option.patternId,
      { advice: option.advice, rank: index + 1 },
    ])
  );
  const top = reading.ranking.slice(0, 5);
  const options: StudioOption[] = top.map((patternId) => ({
    patternId,
    rationale: rationaleFor(reading, patternId),
    advice: byPattern.get(patternId)?.advice ?? null,
    cursorRank: byPattern.get(patternId)?.rank ?? null,
  }));
  const shown = new Set(options.map((o) => o.patternId));
  for (const [patternId, { advice, rank }] of byPattern) {
    if (!shown.has(patternId)) {
      options.push({
        patternId,
        rationale: rationaleFor(reading, patternId),
        advice,
        cursorRank: rank,
      });
    }
  }
  return options;
}
