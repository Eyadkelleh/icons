"use client";

import { motion } from "motion/react";

import type { AdviceState } from "@/components/studio/studio-state";

const TIER_LABEL = {
  fast: "fast model",
  balanced: "balanced model",
  strong: "strong model",
} as const;

function describe(advice: AdviceState): string {
  if (advice.status === "loading") {
    return "Asking Cursor which motion fits…";
  }
  if (advice.status === "failed") {
    return `${advice.message} Showing heuristic ranks.`;
  }
  const { advice: result } = advice;
  if (result.source === "cursor") {
    return `Advised by ${result.modelId} (${TIER_LABEL[result.tier]}: ${result.reason}) in ${(result.durationMs / 1000).toFixed(1)}s.`;
  }
  return `${result.fallback} Model pick: ${result.modelId} (${TIER_LABEL[result.tier]}).`;
}

export const AdviceStatus = ({ advice }: { advice: AdviceState }) => (
  <motion.p
    animate={{ opacity: advice.status === "loading" ? [0.5, 1, 0.5] : 1 }}
    aria-live="polite"
    className="font-mono text-secondary text-xs leading-relaxed"
    data-source={
      advice.status === "done" ? advice.advice.source : advice.status
    }
    data-testid="studio-advice-status"
    transition={
      advice.status === "loading"
        ? { duration: 1.6, repeat: Number.POSITIVE_INFINITY }
        : { duration: 0.2 }
    }
  >
    {describe(advice)}
  </motion.p>
);
