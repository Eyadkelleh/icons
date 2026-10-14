"use client";

import { motion } from "motion/react";

import type { RefineState } from "@/components/studio/studio-state";

const TIER_LABEL = {
  fast: "fast model",
  balanced: "balanced model",
  strong: "strong model",
} as const;

function describe(refine: RefineState): string {
  if (refine.status === "loading") {
    return "Asking Cursor to reread what you wrote…";
  }
  if (refine.status === "failed") {
    return `${refine.message} Using the lexicon.`;
  }
  const { refined } = refine;
  if (refined.source === "cursor") {
    return `Reread by ${refined.modelId} (${TIER_LABEL[refined.tier]}: ${refined.reason}) in ${(refined.durationMs / 1000).toFixed(1)}s.`;
  }
  return `${refined.fallback} Model pick: ${refined.modelId} (${TIER_LABEL[refined.tier]}).`;
}

export const AdviceStatus = ({ refine }: { refine: RefineState }) => (
  <motion.p
    animate={{ opacity: refine.status === "loading" ? [0.5, 1, 0.5] : 1 }}
    aria-live="polite"
    className="font-mono text-secondary text-xs leading-relaxed"
    data-source={
      refine.status === "done" ? refine.refined.source : refine.status
    }
    data-testid="studio-advice-status"
    transition={
      refine.status === "loading"
        ? { duration: 1.6, repeat: Number.POSITIVE_INFINITY }
        : { duration: 0.2 }
    }
  >
    {describe(refine)}
  </motion.p>
);
