import type { SvgAnalysis } from "@/lib/svg-analyze";

export type ModelTier = "fast" | "balanced" | "strong";

export type CatalogModel = {
  id: string;
  parameters?: { id: string; values: { value: string }[] }[];
};

export type PickedModel = {
  tier: ModelTier;
  selection: { id: string; params?: { id: string; value: string }[] };
  reason: string;
};

const ROUTER_ID = "auto-smart";

const TIER_PREFERENCES: Record<ModelTier, string[]> = {
  fast: ["composer-2.5-fast", "composer-2.5", "composer"],
  balanced: ["composer-2.5", "claude-sonnet", "gpt-5"],
  strong: [ROUTER_ID, "claude-opus", "gpt-5", "composer-2.5"],
};

const DEFAULT_WITHOUT_CATALOG: Record<ModelTier, string> = {
  fast: "composer-2.5",
  balanced: "composer-2.5",
  strong: "auto",
};

const ROUTER_MODE: Record<ModelTier, string[]> = {
  fast: ["speed", "balanced"],
  balanced: ["balanced"],
  strong: ["intelligence", "balanced"],
};

export function tierFor(
  analysis: SvgAnalysis,
  spread: number
): {
  tier: ModelTier;
  reason: string;
} {
  if (analysis.complexity >= 70 || analysis.ambiguity >= 60 || spread <= 1) {
    return {
      tier: "strong",
      reason: `complex or ambiguous upload (complexity ${analysis.complexity}, ambiguity ${analysis.ambiguity}, top-two gap ${spread})`,
    };
  }
  if (analysis.complexity < 40 && spread >= 3) {
    return {
      tier: "fast",
      reason: `simple upload with a clear heuristic winner (complexity ${analysis.complexity}, top-two gap ${spread})`,
    };
  }
  return {
    tier: "balanced",
    reason: `moderate upload (complexity ${analysis.complexity}, top-two gap ${spread})`,
  };
}

function routerSelection(
  router: CatalogModel,
  tier: ModelTier
): PickedModel["selection"] | null {
  const optimizeFor = router.parameters?.find((p) => p.id === "optimize_for");
  if (!optimizeFor) {
    return null;
  }
  const allowed = new Set(optimizeFor.values.map((v) => v.value));
  const mode = ROUTER_MODE[tier].find((m) => allowed.has(m));
  return mode
    ? { id: router.id, params: [{ id: optimizeFor.id, value: mode }] }
    : null;
}

function selectFromCatalog(
  tier: ModelTier,
  catalog: CatalogModel[]
): PickedModel["selection"] | null {
  for (const prefix of TIER_PREFERENCES[tier]) {
    const model = catalog.find(
      (m) => m.id === prefix || m.id.startsWith(prefix)
    );
    if (!model) {
      continue;
    }
    if (model.id === ROUTER_ID) {
      const selection = routerSelection(model, tier);
      if (selection) {
        return selection;
      }
      continue;
    }
    return { id: model.id };
  }
  return null;
}

export function pickSuggestModel(
  analysis: SvgAnalysis,
  spread: number,
  catalog: CatalogModel[] | null
): PickedModel {
  const { tier, reason } = tierFor(analysis, spread);
  const selection = (catalog && selectFromCatalog(tier, catalog)) ?? {
    id: DEFAULT_WITHOUT_CATALOG[tier],
  };
  return { tier, selection, reason };
}
