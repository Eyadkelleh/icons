"use client";

import { motion } from "motion/react";

import type { AnimationPatternId } from "@/lib/animation-patterns";
import {
  type AnimationSuggestion,
  patternTitle,
} from "@/lib/suggest-animation";
import { cn } from "@/lib/utils";

type OptionListProps = {
  suggestions: AnimationSuggestion[];
  selectedId: AnimationPatternId;
  onSelect: (patternId: AnimationPatternId) => void;
};

export const OptionList = ({
  suggestions,
  selectedId,
  onSelect,
}: OptionListProps) => (
  <div
    aria-label="Animation options"
    className="flex flex-col gap-2"
    data-testid="studio-options"
    role="radiogroup"
  >
    {suggestions.map((suggestion, index) => {
      const selected = suggestion.patternId === selectedId;
      return (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          aria-checked={selected}
          className={cn(
            "supports-[corner-shape:squircle]:corner-squircle flex w-full cursor-pointer flex-col gap-1 rounded-[16px] border bg-white px-4 py-3 text-left transition-[border-color] duration-150 focus-visible:outline-1 focus-visible:outline-primary supports-[corner-shape:squircle]:rounded-[24px] dark:bg-[#0A0A0A]",
            selected
              ? "border-primary"
              : "border-transparent hover:border-neutral-300 dark:hover:border-neutral-700"
          )}
          data-pattern={suggestion.patternId}
          data-testid="studio-option"
          initial={{ opacity: 0, y: 6 }}
          key={suggestion.patternId}
          onClick={() => onSelect(suggestion.patternId)}
          role="radio"
          transition={{ delay: index * 0.05, duration: 0.2 }}
          type="button"
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-sans text-base">
              {patternTitle(suggestion.patternId)}
            </span>
            <span className="font-mono text-secondary text-xs">
              {index === 0 ? "best fit" : `#${index + 1}`}
            </span>
          </span>
          <span className="font-mono text-secondary text-xs leading-relaxed">
            {suggestion.rationale}
          </span>
        </motion.button>
      );
    })}
  </div>
);
