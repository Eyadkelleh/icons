"use client";

import { motion } from "motion/react";

import {
  type AnimationPatternId,
  patternTitle,
} from "@/lib/animation-patterns";
import { cn } from "@/lib/utils";

export type StudioOption = {
  patternId: AnimationPatternId;
  rationale: string;
};

type OptionListProps = {
  options: StudioOption[];
  selectedId: AnimationPatternId;
  onSelect: (patternId: AnimationPatternId) => void;
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
            <span className="font-mono text-secondary text-xs">
              {index === 0 ? "best fit" : `#${index + 1}`}
            </span>
          </span>
          <span className="font-mono text-secondary text-xs leading-relaxed">
            {option.rationale}
          </span>
        </motion.button>
      );
    })}
  </div>
);
