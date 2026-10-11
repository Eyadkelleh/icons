"use client";

import { useState } from "react";

import {
  MotionFigure,
  type MotionPhase,
} from "@/components/studio/motion-figure";
import {
  type AnimationPatternId,
  patternTitle,
} from "@/lib/animation-patterns";
import type { Casting, SvgNode } from "@/lib/icon-reading";

type PatternPreviewProps = {
  tree: SvgNode;
  casting: Casting;
  patternId: AnimationPatternId;
};

type PreviewProps = PatternPreviewProps & { selection: number };

/**
 * Remount on every selection so leftover transforms never leak between
 * options, and re-selecting the current option replays it.
 */
export const Preview = ({
  tree,
  casting,
  patternId,
  selection,
}: PreviewProps) => (
  <PatternPreview
    casting={casting}
    key={`${patternId}-${selection}`}
    patternId={patternId}
    tree={tree}
  />
);

const PatternPreview = ({ tree, casting, patternId }: PatternPreviewProps) => {
  const [phase, setPhase] = useState<MotionPhase>("animate");
  const [run, setRun] = useState(0);
  const title = patternTitle(patternId);

  const play = () => {
    setPhase("animate");
    setRun((current) => current + 1);
  };
  const stop = () => setPhase("normal");

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        aria-label={`${title} preview`}
        className="flex flex-1 items-center justify-center"
        data-pattern={patternId}
        data-phase={phase}
        data-testid="studio-motion"
        onMouseEnter={play}
        onMouseLeave={stop}
        role="img"
      >
        <MotionFigure
          key={run}
          phase={phase}
          plan={casting.plan}
          size={160}
          tree={tree}
        />
      </div>
      <div className="flex gap-2 font-mono text-xs">
        <button
          className="cursor-pointer rounded-[10px] bg-primary px-3 py-1.5 text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-1 focus-visible:outline-primary focus-visible:outline-offset-2"
          data-testid="studio-play"
          onClick={play}
          type="button"
        >
          Play
        </button>
        <button
          className="cursor-pointer rounded-[10px] px-3 py-1.5 text-secondary transition-colors duration-150 hover:text-foreground focus-visible:outline-1 focus-visible:outline-primary"
          data-testid="studio-stop"
          onClick={stop}
          type="button"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
