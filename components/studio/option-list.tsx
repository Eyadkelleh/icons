"use client";

import { AnimatePresence, motion } from "motion/react";

import type { StudioOption } from "@/components/studio/advised-options";
import type { AnimationPatternId } from "@/lib/animation-patterns";
import { patternTitle } from "@/lib/suggest-animation";
import { cn } from "@/lib/utils";

type OptionListProps = {
  options: StudioOption[];
  selectedId: AnimationPatternId;
  onSelect: (patternId: AnimationPatternId) => void;
};

const rankLabel = (option: StudioOption, index: number) => {
  if (option.cursorRank === 1) {
    return "advised";
  }
  return index === 0 ? "best fit" : `#${index + 1}`;
};

export const OptionList = ({
  options,
  selectedId,
  onSelect,
}: OptionListProps) => (
  <div
    aria-label="Animation options"
    className="flex flex-col gap-2"
    data-testid="studio-options"
    role="radiogroup"
  >
    {options.map((option, index) => {
      const selected = option.patternId === selectedId;
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
          data-pattern={option.patternId}
          data-testid="studio-option"
          initial={{ opacity: 0, y: 6 }}
          key={option.patternId}
          layout="position"
          onClick={() => onSelect(option.patternId)}
          role="radio"
          transition={{ delay: index * 0.05, duration: 0.2 }}
          type="button"
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-sans text-base">
              {patternTitle(option.patternId)}
            </span>
            <span
              className={cn(
                "font-mono text-xs",
                option.cursorRank === 1 ? "text-primary" : "text-secondary"
              )}
            >
              {rankLabel(option, index)}
            </span>
          </span>
          <span className="font-mono text-secondary text-xs leading-relaxed">
            {option.rationale}
          </span>
          <AnimatePresence initial={false}>
            {option.advice && (
              <motion.span
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden font-mono text-foreground text-xs leading-relaxed"
                data-testid="studio-advice"
                initial={{ opacity: 0, height: 0 }}
              >
                Advises: {option.advice}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      );
    })}
  </div>
);
