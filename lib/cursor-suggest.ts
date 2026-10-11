import { Agent, Cursor, CursorAgentError } from "@cursor/sdk";
import { z } from "zod";

import {
  ANIMATION_PATTERNS,
  type AnimationPatternId,
} from "@/lib/animation-patterns";
import {
  type CatalogModel,
  type PickedModel,
  pickSuggestModel,
} from "@/lib/pick-suggest-model";
import type { AnimationSuggestion } from "@/lib/suggest-animation";
import type { SvgAnalysis } from "@/lib/svg-analyze";

export type AdvisedOption = {
  patternId: AnimationPatternId;
  advice: string;
};

export type SuggestAdvice =
  | {
      source: "cursor";
      modelId: string;
      tier: PickedModel["tier"];
      reason: string;
      options: AdvisedOption[];
      durationMs: number;
    }
  | {
      source: "heuristic";
      modelId: string;
      tier: PickedModel["tier"];
      reason: string;
      fallback: string;
    };

const PATTERN_IDS = ANIMATION_PATTERNS.map((p) => p.id) as [
  AnimationPatternId,
  ...AnimationPatternId[],
];

const AdviceSchema = z.object({
  options: z
    .array(
      z.object({
        patternId: z.enum(PATTERN_IDS),
        advice: z.string().min(1).max(280),
      })
    )
    .min(1)
    .max(5),
});

const JSON_BLOCK = /\{[\s\S]*\}/;
const AGENT_TIMEOUT_MS = 45_000;
const CATALOG_TTL_MS = 10 * 60_000;

let catalogCache: { at: number; models: CatalogModel[] } | null = null;

async function loadCatalog(apiKey: string): Promise<CatalogModel[] | null> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.models;
  }
  try {
    const models = await Cursor.models.list({ apiKey });
    catalogCache = { at: Date.now(), models };
    return models;
  } catch {
    return null;
  }
}

function buildPrompt(
  analysis: SvgAnalysis,
  heuristic: AnimationSuggestion[]
): string {
  const catalog = ANIMATION_PATTERNS.map(
    (p) => `- ${p.id}: ${p.when} Avoid when: ${p.avoid}`
  ).join("\n");
  return [
    "You advise which Motion animation fits an uploaded SVG icon.",
    "Do not use tools, read files, or run commands. Answer from the data below only.",
    "Pick up to 5 pattern ids from the catalog, best first. Never invent ids.",
    "Prefer motion that reinforces what the icon means. Never recommend drawing every path as a generic reveal.",
    "",
    "Catalog:",
    catalog,
    "",
    `SVG analysis: ${JSON.stringify({
      counts: analysis.counts,
      shapeGuesses: analysis.shapeGuesses,
      complexity: analysis.complexity,
      ambiguity: analysis.ambiguity,
      hasStroke: analysis.hasStroke,
      hasFill: analysis.hasFill,
    })}`,
    `Heuristic ranking: ${heuristic.map((s) => `${s.patternId}(${s.score})`).join(", ")}`,
    "",
    'Reply with JSON only: {"options":[{"patternId":"<id>","advice":"<one sentence on why and how it should move>"}]}',
  ].join("\n");
}

function parseAdvice(text: string): AdvisedOption[] | null {
  const block = text.match(JSON_BLOCK)?.[0];
  if (!block) {
    return null;
  }
  try {
    const parsed = AdviceSchema.safeParse(JSON.parse(block));
    return parsed.success ? parsed.data.options : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function adviseWithCursor(
  analysis: SvgAnalysis,
  heuristic: AnimationSuggestion[],
  spread: number,
  apiKey: string | undefined = process.env.CURSOR_API_KEY
): Promise<SuggestAdvice> {
  if (!apiKey) {
    const picked = pickSuggestModel(analysis, spread, null);
    return {
      source: "heuristic",
      modelId: picked.selection.id,
      tier: picked.tier,
      reason: picked.reason,
      fallback: "CURSOR_API_KEY is not set, so only heuristic ranks are shown.",
    };
  }

  const picked = pickSuggestModel(analysis, spread, await loadCatalog(apiKey));
  const started = Date.now();
  try {
    const result = await withTimeout(
      Agent.prompt(buildPrompt(analysis, heuristic), {
        apiKey,
        model: picked.selection,
        cloud: { repos: [] },
      }),
      AGENT_TIMEOUT_MS
    );
    const options =
      result.status === "finished" ? parseAdvice(result.result ?? "") : null;
    if (!options) {
      return {
        source: "heuristic",
        modelId: picked.selection.id,
        tier: picked.tier,
        reason: picked.reason,
        fallback: `Cursor agent returned ${result.status} without usable advice.`,
      };
    }
    return {
      source: "cursor",
      modelId: picked.selection.id,
      tier: picked.tier,
      reason: picked.reason,
      options,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const detail =
      error instanceof CursorAgentError || error instanceof Error
        ? error.message
        : "unknown error";
    return {
      source: "heuristic",
      modelId: picked.selection.id,
      tier: picked.tier,
      reason: picked.reason,
      fallback: `Cursor agent unavailable (${detail}).`,
    };
  }
}
